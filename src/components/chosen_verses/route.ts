import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq } from 'drizzle-orm';
/////
import { db } from "../../database/index.js"
import { chosen_verses_table } from "../../database/schemas.js"
import {one_schema} from "../../schemas/chosen_verse.js"
import { get_one_res, create_many_req, create_many_res, create_one_req, create_one_res, update_req } from './schema.js'
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
///// Utils
import { auth_header_validator, id_param_validator, json_validator, query_validator } from '../../utils/validators.js'
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema} from '../../schemas/api.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { verify_adminstrator } from '../../utils/auth.js';

export const chosen_verses_route = new Hono()  

const cache_prefix = "chosen_verses" 


chosen_verses_route.get(
    "/chosen_verses",
    describeRoute({
        tags: ["ChosenVerses"],
        summary: "Get All",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get All ChosenVerses", get_all_schema(one_schema)),
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
            let { created_at, updated_at, ...rest} = getTableColumns(chosen_verses_table) // select all columns, except created_at & updated_at.
            let [chosen_verses, counts] = await Promise.all([
                await db.select({...rest}).from(chosen_verses_table).limit(limit).offset(offset),
                await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(chosen_verses_table)
            ])
            
            let total_count = counts[0] ? counts[0].total_count : 0 

            return c.json(
                {
                    data: chosen_verses,
                    limit, 
                    offset, 
                    total_count: total_count
                },
                HttpStatusCode.OK
            )
        } catch(e) {
            logger.error({error:e}, "Error in GET /chosen_verses")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }

    }
)

chosen_verses_route.get(
    "/chosen_verses/:id",
    describeRoute({
        tags: ["ChosenVerses"],
        summary: "Get One",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get ChosenVerse", get_one_res),
           ...get_described_route(HttpStatusCode.NOT_FOUND, "ChosenVerse's not Found", base_response_schema),
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

            let { created_at, updated_at, ...rest} = getTableColumns(chosen_verses_table) // select all columns, except created_at & updated_at.
            let chosen_verse = await db.query.chosen_verses_table.findFirst({
                columns: {
                    id: true,
                    adeeb_id: true,
                    poem_id: true,
                    tags: true,
                    verses: true,
                    is_couplet: true,
                    reviewed: true,
                },
                with: {
                    adeeb: {
                        columns: {
                            id: true,
                            name: true,
                        }
                    },
                    poem: {
                        columns: {
                            id: true,
                            intro: true
                        }
                    },
                },
                where: (chosen_verses_table, { eq }) => eq(chosen_verses_table.id, id),
            })
            if (!chosen_verse) {
                return c.json({message: "ChosenVerse's not Found"}, HttpStatusCode.NOT_FOUND)
            }

            await cache_set(cache_key, chosen_verse)

            return c.json(chosen_verse, HttpStatusCode.OK)

        } catch(e) {
            logger.error({error:e}, "Error in GET /chosen_verses/:id")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

chosen_verses_route.post(
    "/chosen_verses",
    describeRoute({
        tags: ["ChosenVerses"],
        summary: "Create One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful added ChosenVerse", create_one_res),
           ...get_described_route(HttpStatusCode.CONFLICT, "ChosenVerse already exists", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_one_req, "Invalid data for ChosenVerse"),
    async(c) => {
        try {
            let new_data = await c.req.json()
            let new_chosen_verse = await db
                .insert(chosen_verses_table)
                .values(new_data)
                // .onConflictDoNothing()
                .returning()
                .then(res => res[0])
            
            // if the first item in res[0] is undefined,
            // then there was a conflict and it already exists
            if (!new_chosen_verse) {
                return c.json({ message: "ChosenVerse already exists"}, HttpStatusCode.NOT_ACCEPTABLE) 
            }
            return c.json(new_chosen_verse, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /chosen_verses")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

chosen_verses_route.post(
    "/chosen_verses/many",
    describeRoute({
        tags: ["ChosenVerses"],
        summary: "Create Many",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", create_many_res),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema)
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_many_req, "Invalid data, can't be used to create many ChosenVerses"),
    async (c) => {
        try {
            let new_data = await c.req.json()
            let new_chosen_verses = await db
                .insert(chosen_verses_table)
                .values(new_data)
                // .onConflictDoNothing()
                .returning()

            return c.json({created_items: new_chosen_verses, success_count: new_chosen_verses.length, failed_count: new_data.length - new_chosen_verses.length}, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /chosen_verses/many")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

chosen_verses_route.put(
    "/chosen_verses/:id",
    describeRoute({
        tags: ["ChosenVerses"],
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
            
            await db.update(chosen_verses_table).set({...data, updated_at: sql`NOW()`}).where(eq(chosen_verses_table.id, id))

            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)


            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in PUT /chosen_verses/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

chosen_verses_route.delete(
    "/chosen_verses/:id",
    describeRoute({
        tags: ["ChosenVerses"],
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
            
            await db.delete(chosen_verses_table).where(eq(chosen_verses_table.id, id))

            // Delete from cache after delete to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in DELETE /chosen_verses/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)
