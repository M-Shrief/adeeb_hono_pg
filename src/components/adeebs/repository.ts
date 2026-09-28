import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { adeeb_table } from "../../database/schemas.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { adeeb } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';

const cache_prefix = "adeebs" 

// const get_all = async (limit: number, offset: number) => {}
const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as adeeb
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



export const repository = {
    // get_all
    get_one_by_id
}
