import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq } from 'drizzle-orm';
/////
import { db } from "../../database/index.js"
import { adeeb_table } from "../../database/schemas.js"
import {one_schema} from "../../schemas/adeeb.js"
import { get_one_res, create_many_req, create_many_res, create_one_req, create_one_res, update_req } from './schema.js'
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { auth_header_validator, id_param_validator, json_validator, query_validator } from '../../utils/validators.js'
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../schemas/api.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { verify_adminstrator } from '../../utils/auth.js';

export const adeeb_route = new Hono()  

const cache_prefix = "adeebs" 


adeeb_route.get(
    "/adeebs",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Get All",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get All Adeebs", get_all_schema(one_schema)),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    query_validator(queries_schema_for_get_all_req),
    async(c) => {
        try {
            let limit = Number(c.req.query('limit')) || 100
            let offset = Number(c.req.query('offset')) || 0
            // We make 2 seperate queries, to get the data & the total_count of rows.
            // we can make 1 query, but we'll need to make manual transformation
            // so that we remove the count field from every item in the array.
            let { created_at, updated_at, ...rest} = getTableColumns(adeeb_table) // select all columns, except created_at & updated_at.
            let [adeebs, counts] = await Promise.all([
                await db.select({...rest}).from(adeeb_table).limit(limit).offset(offset),
                await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(adeeb_table)
            ])
            
            let total_count = counts[0] ? counts[0].total_count : 0 

            return c.json(
                {
                    data: adeebs,
                    limit, 
                    offset, 
                    total_count: total_count
                },
                HttpStatusCode.OK
            )
        } catch(e) {
            logger.error({error:e}, "Error in GET /adeebs")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }

    }
)

adeeb_route.get(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Get One",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get Adeeb", get_one_res),
           ...get_described_route(HttpStatusCode.NOT_FOUND, "Adeeb's not Found", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    id_param_validator(),
    async(c) => {
        try {
            let id = c.req.param("id")

            let cache_key = format_key_by_id(cache_prefix, id)
            let cache_res = await cache_get(cache_key)

            if(cache_res) {
                return c.json(cache_res, HttpStatusCode.OK)
            }

            let adeeb = await db.query.adeeb_table.findFirst({
                columns: {
                    id: true,
                    name: true,
                    bio: true,
                    time_period: true,
                    reviewed: true,
                },
                with: {
                    poems: {
                        columns: {
                            id: true,
                            intro: true,
                        }
                    },
                    chosen_verses: {
                        columns: {
                            id: true,
                            verses: true,
                            is_couplet: true,
                        }
                    },
                    prose_qoutes: {
                        columns: {
                            id: true,
                            qoute: true
                        }
                    },
                },
                where: (adeeb_table, { eq }) => eq(adeeb_table.id, id),
            })
            if (!adeeb) {
                return c.json({message: "Adeeb's not Found"}, HttpStatusCode.NOT_FOUND)
            }
            await cache_set(cache_key, adeeb)
            return c.json(adeeb, HttpStatusCode.OK)

        } catch(e) {
            logger.error({error:e}, "Error in GET /adeebs/:id")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.post(
    "/adeebs",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Create One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful added Adeeb", create_one_res),
           ...get_described_route(HttpStatusCode.CONFLICT, "Adeeb already exists", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_one_req, "Invalid data for Adeeb"),
    async(c) => {
        try {
            let new_data = await c.req.json()
            let new_adeeb = await db
                .insert(adeeb_table)
                .values(new_data)
                .onConflictDoNothing({ target: [adeeb_table.name]})
                .returning()
                .then(res => res[0])
            
            // if the first item in res[0] is undefined,
            // then there was a conflict and it already exists
            if (!new_adeeb) {
                return c.json({ message: "Adeeb already exists"}, HttpStatusCode.NOT_ACCEPTABLE) 
            }
            return c.json(new_adeeb, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /adeebs")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.post(
    "/adeebs/many",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Create Many",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", create_many_res),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema)
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_many_req, "Invalid data, can't be used to create many Adeebs"),
    async (c) => {
        try {
            let new_data: any[] = await c.req.json()
            let new_adeebs: any[] = []
            let invalid_items: InvalidItemType[] = []
            for(let [index, item] of new_data.entries()) {
                let new_adeeb = await db
                    .insert(adeeb_table)
                    .values(item)
                    .onConflictDoNothing({ target: [adeeb_table.name]})
                    .returning()
                    .then(res => res[0])
                    .catch(() => undefined)

                if(!new_adeeb) {
                    invalid_items.push({item_index: index, message: "Adeeb already exists"})
                    continue
                }
                new_adeebs.push(new_adeeb)
            }

            return c.json({created_items: new_adeebs, success_count: new_adeebs.length, invalid_items}, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /adeebs/many")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.put(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Update One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.NO_CONTENT, "Updated Successfully"),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request, try again later.", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    id_param_validator(),
    json_validator(update_req, "Invalid data for update"),
    async(c) => {
        try {
            let id = c.req.param("id")
            let data = await c.req.json()
            
            await db.update(adeeb_table).set({...data, updated_at: sql`NOW()`}).where(eq(adeeb_table.id, id))

            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in PUT /adeebs/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.delete(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Delete One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.NO_CONTENT, "Deleted Successfully"),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request, try again later.", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    id_param_validator(),
    async (c) => {
        try {
            let id = c.req.param("id")
            
            await db.delete(adeeb_table).where(eq(adeeb_table.id, id))

            // Delete from cache after delete to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error Delete /adeebs/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)
