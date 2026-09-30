import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { prose_qoutes_table } from "../../database/schemas.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { prose_qoute } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { InvalidItemType } from '../../schemas/api.js';

const cache_prefix = "prose_qoutes" 

const get_all = async (limit: number, offset: number) => {
    try {
        // We make 2 seperate queries, to get the data & the total_count of rows.
        // we can make 1 query, but we'll need to make manual transformation
        // so that we remove the count field from every item in the array.
        let { created_at, updated_at, ...rest} = getTableColumns(prose_qoutes_table) // select all columns, except created_at & updated_at.
        let [prose_qoutes, counts] = await Promise.all([
            await db.select({...rest}).from(prose_qoutes_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(prose_qoutes_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: prose_qoutes,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /prose_qoutes")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as prose_qoute
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
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        await cache_set(cache_key, prose_qoute)
        return prose_qoute
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /prose_qoutes/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const create_one = async(new_data: any) => {
    try {
        let err_msg = null;
        let new_prose_qoute = await db
            .insert(prose_qoutes_table)
            .values(new_data)
            // .onConflictDoNothing()
            .returning()
            .then(res => res[0])
            .catch((err: DrizzleQueryError) => {
                if ((err.cause as any).code === "23503") {
                    err_msg = "Foriegn key error"
                }
                return undefined
            })
            
        if(!new_prose_qoute) {
            if(!err_msg) {
                err_msg = "Error inserting ProseQoute, try again later"
            }
            // return c.json({ message: err_msg}, HttpStatusCode.CONFLICT) 
            throw new APIError(HttpStatusCode.CONFLICT, "repository", err_msg)
        }
        return new_prose_qoute
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /prose_qoutes")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_many = async(new_data: any[]) => {
    try {
        let new_prose_qoutes: any[] = []
        let invalid_items: InvalidItemType[] = []

        for(let [index, item] of new_data.entries()) {
            let err_msg = null;
            let new_prose_qoute = await db
                .insert(prose_qoutes_table)
                .values(item)
                // .onConflictDoNothing()
                .returning()
                .then(res => res[0])
                .catch((err: DrizzleQueryError) => {
                    if ((err.cause as any).code === "23503") {
                        err_msg = "Foriegn key error"
                    }
                    return undefined
                })
            
            if(!new_prose_qoute) {
                if(!err_msg) {
                    err_msg = "Error inserting ProseQoute, try again later"
                }
                invalid_items.push({item_index: index, message: err_msg})
                continue
            }
            new_prose_qoutes.push(new_prose_qoute)
        }
        return {created_items: new_prose_qoutes, success_count: new_prose_qoutes.length, invalid_items}
    } catch(e) {
        logger.error({error:e}, "Error in POST /prose_qoutes/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const update_one = async(id: string, data: any) => {
    try {        
        await db.update(prose_qoutes_table).set({...data, updated_at: sql`NOW()`}).where(eq(prose_qoutes_table.id, id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /prose_qoutes/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_one = async(id: string) => {
    try {        
        await db.delete(prose_qoutes_table).where(eq(prose_qoutes_table.id, id))

        // Delete from cache after delete to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /prose_qoutes/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    


export const repository = {
    get_all,
    get_one_by_id,
    create_one,
    create_many,
    update_one,
    delete_one,
}
