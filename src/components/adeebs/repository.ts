import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { adeeb_table } from "../../database/schemas.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { Adeeb } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { InvalidItemType } from '../../schemas/api.js';

const cache_prefix = "adeebs" 

const get_all = async (limit: number, offset: number) => {
    try {
        // We make 2 seperate queries, to get the data & the total_count of rows.
        // we can make 1 query, but we'll need to make manual transformation
        // so that we remove the count field from every item in the array.
        let { created_at, updated_at, ...rest} = getTableColumns(adeeb_table) // select all columns, except created_at & updated_at.
        let [adeebs, counts] = await Promise.all([
            await db.select({...rest}).from(adeeb_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(adeeb_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: adeebs,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /adeebs")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as Adeeb
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
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        await cache_set(cache_key, adeeb)
        return adeeb
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /adeebs/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const create_one = async(new_data: any) => {
    try {
        let err_msg = null
        let new_adeeb = await db
            .insert(adeeb_table)
            .values(new_data)
            .onConflictDoNothing({ target: [adeeb_table.name]})
            .returning()
            .then(res => res[0])
            .catch((err: DrizzleQueryError) => {
                err_msg = "Error inserting Adeeb, try again later"
                return undefined
            })

        
        // if the first item in res[0] is undefined,
        // then there was a conflict and it already exists
        if (!new_adeeb) {
            if(err_msg == null) {
                // if it doesn't have err_msg, then it had unique constraint violation
                err_msg = "Adeeb already exists"
            } 
            // return c.json({ message: err_msg}, HttpStatusCode.CONFLICT) 
            throw new APIError(HttpStatusCode.CONFLICT, "repository", err_msg)
        }
        return new_adeeb
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /adeebs")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_many = async(new_data: any[]) => {
    try {
        let new_adeebs: any[] = []
        let invalid_items: InvalidItemType[] = []
        for(let [index, item] of new_data.entries()) {
            let err_msg = null
            let new_adeeb = await db
                .insert(adeeb_table)
                .values(item)
                .onConflictDoNothing({ target: [adeeb_table.name]})
                .returning()
                .then(res => res[0])
                .catch((err: DrizzleQueryError) => {
                    err_msg = "Error inserting Adeeb, try again later"
                    return undefined
                })

            if(!new_adeeb) {
                if(err_msg == null) {
                    // if it doesn't have err_msg, then it had unique constraint violation
                    err_msg = "Adeeb already exists"
                } 

                invalid_items.push({item_index: index, message: err_msg})
                continue
            }
            new_adeebs.push(new_adeeb)
        }
        return {created_items: new_adeebs, success_count: new_adeebs.length, invalid_items}
    } catch(e) {
        logger.error({error:e}, "Error in POST /adeebs/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const update_one = async(id: string, data: any) => {
    try {        
        await db.update(adeeb_table).set({...data, updated_at: sql`NOW()`}).where(eq(adeeb_table.id, id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /adeebs/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_one = async(id: string) => {
    try {        
        await db.delete(adeeb_table).where(eq(adeeb_table.id, id))

        // Delete from cache after delete to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /adeebs/:id")
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
