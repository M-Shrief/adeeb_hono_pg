import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq } from 'drizzle-orm';
/////
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { db } from "../../database/index.js"
import { poem_table } from "../../database/schemas.js"
import {one_schema} from "../../schemas/poem.js"
import { get_one_res, create_many_req, create_many_res, create_one_req, create_one_res, update_req } from './schema.js'
import { auth_header_validator, id_param_validator, json_validator, query_validator } from '../../utils/validators.js'
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../schemas/api.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { verify_adminstrator } from '../../utils/auth.js';

export const poem_route = new Hono()  

const cache_prefix = "poems" 


poem_route.get(
    "/poems",
    describeRoute({
        tags: ["Poems"],
        summary: "Get All",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get All Poems", get_all_schema(one_schema)),
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
            let { created_at, updated_at, ...rest} = getTableColumns(poem_table) // select all columns, except created_at & updated_at.
            let [poems, counts] = await Promise.all([
                await db.select({...rest}).from(poem_table).limit(limit).offset(offset),
                await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(poem_table)
            ])
            
            let total_count = counts[0] ? counts[0].total_count : 0 

            return c.json(
                {
                    data: poems,
                    limit, 
                    offset, 
                    total_count: total_count
                },
                HttpStatusCode.OK
            )
        } catch(e) {
            logger.error({error:e}, "Error in GET /poems")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

poem_route.get(
    "/poems/:id",
    describeRoute({
        tags: ["Poems"],
        summary: "Get One",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get Poem", get_one_res),
           ...get_described_route(HttpStatusCode.NOT_FOUND, "Poem's not Found", base_response_schema),
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

            let { created_at, updated_at, ...rest} = getTableColumns(poem_table) // select all columns, except created_at & updated_at.
            let poem = await db.query.poem_table.findFirst({
                columns: {
                    id: true,
                    intro: true,
                    verses: true,
                    is_couplet: true,
                    reviewed: true,

                    adeeb_id: true,
                },
                with: {
                    adeeb: {
                        columns: {
                            id: true,
                            name: true,
                        }
                    },
                    chosen_verses: {
                        columns: {
                            id: true,
                            verses: true,
                            is_couplet: true,
                        }
                    },
                },
                where: (poem_table, { eq }) => eq(poem_table.id, id),
            })
            if (!poem) {
                return c.json({message: "Poem's not Found"}, HttpStatusCode.NOT_FOUND)
            }

            await cache_set(cache_key, poem)

            return c.json(poem, HttpStatusCode.OK)
        } catch(e) {
            logger.error({error:e}, "Error in GET /poems/:id")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

poem_route.post(
    "/poems",
    describeRoute({
        tags: ["Poems"],
        summary: "Create One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful added Poem", create_one_res),
           ...get_described_route(HttpStatusCode.CONFLICT, "Poem already exists", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),    
    json_validator(create_one_req, "Invalid data for Poem"),
    async(c) => {
        try {
            let new_data = await c.req.json()
            let new_poem = await db
                .insert(poem_table)
                .values(new_data)
                .onConflictDoNothing({ target: [poem_table.intro]})
                .returning()
                .then(res => res[0])
                .catch(() => undefined)
            
            // if the first item in res[0] is undefined,
            // then there was a conflict or foriegn key error
            if (!new_poem) {
                return c.json({ message: "Poem already exists"}, HttpStatusCode.NOT_ACCEPTABLE) 
            }
            return c.json(new_poem, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /poems")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

poem_route.post(
    "/poems/many",
    describeRoute({
        tags: ["Poems"],
        summary: "Create Many",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", create_many_res),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema)
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_many_req, "Invalid data, can't be used to create many Poems"),
    async(c) => {
        try {
            let new_data: any[] = await c.req.json()
            let new_poems: any[] = []
            let invalid_items: InvalidItemType[] = []
            for(let [index, item] of new_data.entries()) {
                let new_poem = await db
                    .insert(poem_table)
                    .values(item)
                    .onConflictDoNothing({ target: [poem_table.intro]})
                    .returning()
                    .then(res => res[0])
                    .catch(() => undefined)

                if(!new_poem) {
                    invalid_items.push({item_index: index, message: "Poem already exists"})
                    continue
                }
                new_poems.push(new_poem)

            }
            return c.json({created_items: new_poems, success_count: new_poems.length, invalid_items}, HttpStatusCode.CREATED)
        } catch(e) {
            logger.error({error:e}, "Error in POST /poems/many")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

poem_route.put(
    "/poems/:id",
    describeRoute({
        tags: ["Poems"],
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
            
            await db.update(poem_table).set({...data, updated_at: sql`NOW()`}).where(eq(poem_table.id, id))
            
            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in PUT /poems/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

poem_route.delete(
    "/poems/:id",
    describeRoute({
        tags: ["Poems"],
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
    async(c) => {
        try {
            let id = c.req.param("id")
            
            await db.delete(poem_table).where(eq(poem_table.id, id))

            // Delete from cache after delete to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error in DELETE /poems/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)
