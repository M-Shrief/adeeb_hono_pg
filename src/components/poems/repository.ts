import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { poem_table } from "../../database/schemas.js"
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { InvalidItemType } from '../../schemas/api.js';
import { Poem } from './type.js';


const cache_prefix = "poems" 

const get_all = async (limit: number, offset: number) => {
    try {
        // We make 2 seperate queries, to get the data & the total_count of rows.
        // we can make 1 query, but we'll need to make manual transformation
        // so that we remove the count field from every item in the array.
        let { created_at, updated_at, ...rest} = getTableColumns(poem_table) // select all columns, except created_at & updated_at.
        let [poems, counts] = await Promise.all([
            await db.select({...rest}).from(poem_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(poem_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 


        return {
            data: poems,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /poems")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as Poem
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
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        await cache_set(cache_key, poem)
        return poem
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /poems/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const create_one = async(new_data: any) => {
    try {
        let err_msg = null
        let new_poem = await db
            .insert(poem_table)
            .values(new_data)
            .onConflictDoNothing({ target: [poem_table.intro]})
            .returning()
            .then(res => res[0])
            .catch((err: DrizzleQueryError) => {
                if ((err.cause as any).code === "23503") {
                    err_msg = "Foriegn key error"
                } else {
                    err_msg = "Error inserting Poem, try again later"
                }
                return undefined
            })
        
        // if the first item in res[0] is undefined,
        // then there was a conflict or foriegn key error
        if (!new_poem) {
            if(err_msg == null) {
                // if it doesn't have err_msg, then it had unique constraint violation
                err_msg = "Poem already exists"
            } 
            // return c.json({ message: err_msg}, HttpStatusCode.CONFLICT) 
            throw new APIError(HttpStatusCode.CONFLICT, "repository", err_msg)
        }
        return new_poem
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /poems")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_many = async(new_data: any[]) => {
    try {
        let new_poems: any[] = []
        let invalid_items: InvalidItemType[] = []
        for(let [index, item] of new_data.entries()) {
            let err_msg = null
            let new_poem = await db
                .insert(poem_table)
                .values(item)
                .onConflictDoNothing({ target: [poem_table.intro]})
                .returning()
                .then(res => res[0])
                .catch((err: DrizzleQueryError) => {
                    if ((err.cause as any).code === "23503") {
                        err_msg = "Foriegn key error"
                    } else {
                        err_msg = "Error inserting Poem, try again later"
                    }
                    return undefined
                })

            if(!new_poem) {
                if(err_msg == null) {
                    // if it doesn't have err_msg, then it had unique constraint violation
                    err_msg = "Poem already exists"
                } 
                invalid_items.push({item_index: index, message: err_msg})
                continue
            }
            new_poems.push(new_poem)
        }
        return {created_items: new_poems, success_count: new_poems.length, invalid_items}
    } catch(e) {
        logger.error({error:e}, "Error in POST /poems/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const update_one = async(id: string, data: any) => {
    try {        
        await db.update(poem_table).set({...data, updated_at: sql`NOW()`}).where(eq(poem_table.id, id))
        
        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /poems/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_one = async(id: string) => {
    try {       
        await db.delete(poem_table).where(eq(poem_table.id, id))

        // Delete from cache after delete to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /poems/:id")
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
