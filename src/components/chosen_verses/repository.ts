import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { chosen_verses_table } from "../../database/schemas.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { chosen_verse } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { InvalidItemType } from '../../schemas/api.js';

const cache_prefix = "chosen_verses" 

const get_all = async (limit: number, offset: number) => {
    try {
        // We make 2 seperate queries, to get the data & the total_count of rows.
        // we can make 1 query, but we'll need to make manual transformation
        // so that we remove the count field from every item in the array.
        let { created_at, updated_at, ...rest} = getTableColumns(chosen_verses_table) // select all columns, except created_at & updated_at.
        let [chosen_verses, counts] = await Promise.all([
            await db.select({...rest}).from(chosen_verses_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(chosen_verses_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: chosen_verses,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /chosen_verses")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as chosen_verse
        }

        let { created_at, updated_at, ...rest} = getTableColumns(chosen_verses_table) // select all columns, except created_at & updated_at.
        let chosen_verse = await db.query.chosen_verses_table.findFirst({
            columns: {
                id: true,
                chosen_verse_id: true,
                poem_id: true,
                tags: true,
                verses: true,
                is_couplet: true,
                reviewed: true,
            },
            with: {
                chosen_verse: {
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
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        await cache_set(cache_key, chosen_verse)
        return chosen_verse
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /chosen_verses/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const create_one = async(new_data: any) => {
    try {
        let err_msg = null
        let new_chosen_verse = await db
            .insert(chosen_verses_table)
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

        if (!new_chosen_verse) {
            if(!err_msg) {
                err_msg = "Error inserting ChosenVerse, try again later"
            }
            throw new APIError(HttpStatusCode.CONFLICT, "repository", err_msg)
        }
        return new_chosen_verse
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /chosen_verses")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_many = async(new_data: any[]) => {
    try {
        let new_chosen_verses: any[] = []
        let invalid_items: InvalidItemType[] = []
        for(let [index, item] of new_data.entries()) {
            let err_msg = null;
            let new_chosen_verse = await db
                .insert(chosen_verses_table)
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

            if(!new_chosen_verse) {
                if(!err_msg) {
                    err_msg = "Error inserting ChosenVerse, try again later"
                }
                invalid_items.push({item_index: index, message: err_msg})
                continue
            }
            new_chosen_verses.push(new_chosen_verse)
        }
        return {created_items: new_chosen_verses, success_count: new_chosen_verses.length, invalid_items}
    } catch(e) {
        logger.error({error:e}, "Error in POST /chosen_verses/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const update_one = async(id: string, data: any) => {
    try {        
        await db.update(chosen_verses_table).set({...data, updated_at: sql`NOW()`}).where(eq(chosen_verses_table.id, id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /chosen_verses/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_one = async(id: string) => {
    try {        
        await db.delete(chosen_verses_table).where(eq(chosen_verses_table.id, id))

        // Delete from cache after delete to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /chosen_verses/:id")
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
