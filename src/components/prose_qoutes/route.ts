import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq } from 'drizzle-orm';
/////
import { db } from "../../database/index.js"
import { prose_qoutes_table } from "../../database/schemas.js"
import {one_schema} from "../../schemas/prose_qoute.js"
import { get_one_res, create_many_req, create_many_res, create_one_req, create_one_res, update_req } from './schema.js'
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { auth_header_validator, id_param_validator, json_validator, query_validator } from '../../utils/validators.js'
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../schemas/api.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { verify_adminstrator } from '../../utils/auth.js';

export const prose_qoute_route = new Hono()  

const cache_prefix = "prose_qoutes" 

prose_qoute_route.get(
    "/prose_qoutes",
    describeRoute({
        tags: ["ProseQoutes"],
        summary: "Get All",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get All ProseQoutes", get_all_schema(one_schema)),
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
            let { created_at, updated_at, ...rest} = getTableColumns(prose_qoutes_table) // select all columns, except created_at & updated_at.
            let [prose_qoutes, counts] = await Promise.all([
                await db.select({...rest}).from(prose_qoutes_table).limit(limit).offset(offset),
                await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(prose_qoutes_table)
            ])
            
            let total_count = counts[0] ? counts[0].total_count : 0 

            return c.json(
                {
                    data: prose_qoutes,
                    limit, 
                    offset, 
                    total_count: total_count
                },
                HttpStatusCode.OK
            )
        } catch(e) {
            logger.error({error:e}, "Error in GET /prose_qoutes")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }

    }
)

prose_qoute_route.get(
    "/prose_qoutes/:id",
    describeRoute({
        tags: ["ProseQoutes"],
        summary: "Get One",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get ProseQoute", get_one_res),
           ...get_described_route(HttpStatusCode.NOT_FOUND, "ProseQoute's not Found", base_response_schema),
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

            let prose_qoute = await db.query.prose_qoutes_table.findFirst({
                columns: {
                    id: true,
                    qoute: true,
                    source: true,
                    tags: true,
                    adeeb_id: true,
                    reviewed: true,
                },
                with: {
                    adeeb: {
                        columns: {
                            id: true,
                            name: true,
                        }
                    },
                },
                where: (prose_qoutes_table, { eq }) => eq(prose_qoutes_table.id, id),
            })
            if (!prose_qoute) {
                return c.json({message: "ProseQoute's not Found"}, HttpStatusCode.NOT_FOUND)
            }

            await cache_set(cache_key, prose_qoute)

            return c.json(prose_qoute, HttpStatusCode.OK)

        } catch(e) {
            logger.error({error:e}, "Error in GET /prose_qoutes/:id")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

prose_qoute_route.post(
    "/prose_qoutes",
    describeRoute({
        tags: ["ProseQoutes"],
        summary: "Create One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful added ProseQoute", create_one_res),
           ...get_described_route(HttpStatusCode.CONFLICT, "ProseQoute already exists", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_one_req, "Invalid data for ProseQoute"),
    async(c) => {
        try {
            let new_data = await c.req.json()
            let new_prose_qoute = await db
                .insert(prose_qoutes_table)
                .values(new_data)
                // .onConflictDoNothing()
                .returning()
                .then(res => res[0])
            
            // if the first item in res[0] is undefined,
            // then there was a conflict and it already exists
            // if (!new_prose_qoute) {
            //     return c.json({ message: "ProseQoute already exists"}, HttpStatusCode.NOT_ACCEPTABLE) 
            // }
            return c.json(new_prose_qoute, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /prose_qoutes")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

prose_qoute_route.post(
    "/prose_qoutes/many",
    describeRoute({
        tags: ["ProseQoutes"],
        summary: "Create Many",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", create_many_res),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema)
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_many_req, "Invalid data, can't be used to create many ProseQoutes"),
    async (c) => {
        try {
            let new_data: any[] = await c.req.json()
            let new_prose_qoutes: any[] = []
            let invalid_items: InvalidItemType[] = []

            for(let [index, item] of new_data.entries()) {
                let new_prose_qoute = await db
                    .insert(prose_qoutes_table)
                    .values(item)
                    // .onConflictDoNothing()
                    .returning()
                    .then(res => res[0])
                
                if(!new_prose_qoute) {
                    invalid_items.push({item_index: index, message: "Error inserting prose_qoute, try again later"})
                    continue
                }
                new_prose_qoutes.push(new_prose_qoute)
            }

            return c.json({created_items: new_prose_qoutes, success_count: new_prose_qoutes.length, invalid_items}, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /prose_qoutes/many")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

prose_qoute_route.put(
    "/prose_qoutes/:id",
    describeRoute({
        tags: ["ProseQoutes"],
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
            
            await db.update(prose_qoutes_table).set({...data, updated_at: sql`NOW()`}).where(eq(prose_qoutes_table.id, id))

            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in PUT /prose_qoutes/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

prose_qoute_route.delete(
    "/prose_qoutes/:id",
    describeRoute({
        tags: ["ProseQoutes"],
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
            
            await db.delete(prose_qoutes_table).where(eq(prose_qoutes_table.id, id))

            // Delete from cache after delete to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in DELETE /prose_qoutes/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)
