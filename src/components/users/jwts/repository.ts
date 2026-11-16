import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
import {randomUUID} from "node:crypto"
import { FlushMode } from '@valkey/valkey-glide';
// /////
import { logger } from '../../../utils/logger.js';
import { db } from "../../../database/index.js"
import { jwt_table, TokenType, TokenTypeEnum } from "../../../database/schemas.js";
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../../cache/utils.js"
import { cache } from "../../../cache/index.js"
import { Claims } from "../../../schemas/jwt.js";
import * as time_utils from "../../../utils/time.js"
import {ACCESS_EXP_MIN_DELTA, REFRESH_EXP_MIN_DELTA} from "../../../auth/jwt.js"
import { APIError } from '../../../utils/errors.js'
import { HttpStatusCode } from '../../../utils/api.js';
import { JWTType } from './scheme.js';

const cache_prefix = "jwts" 

/**
 * return new JWT claims for access & refresh token respectively
 */
const new_tokens = async(user: Claims["user"], family_id?: string) => {
    try {
        if (!family_id) {
            family_id = randomUUID()
        }
        let access_model = {
            jti: "",
            user_id: user?.id,
            family_id: family_id,
            is_banned: false,
            token_type: TokenTypeEnum.ACCESS as TokenType, 
            exp: time_utils.NowWithDelta(ACCESS_EXP_MIN_DELTA),
            iat: time_utils.Now()
        }
        let refresh_model = {
            jti: "",
            user_id: user?.id,
            family_id: family_id,
            is_banned: false,
            token_type: TokenTypeEnum.REFRESH as TokenType,
            exp: time_utils.NowWithDelta(REFRESH_EXP_MIN_DELTA),
            iat: time_utils.Now()
        }

        await db
            .insert(jwt_table)
            .values([
                {
                    user_id: access_model.user_id!,
                    family_id: access_model.family_id,
                    is_banned: access_model.is_banned,
                    token_type: access_model.token_type,
                    exp: access_model.exp,
                    iat: access_model.iat,
                },
                {
                    user_id: refresh_model.user_id!,
                    family_id: refresh_model.family_id,
                    is_banned: refresh_model.is_banned,
                    token_type: refresh_model.token_type,
                    exp: refresh_model.exp,
                    iat: refresh_model.iat,
                }
            ])
            .onConflictDoNothing()
            .returning()
            .then(res => {
                for (let token of res) {
                    if(token.token_type == TokenTypeEnum.ACCESS) {
                        access_model.jti = token.jti
                    } else {
                        refresh_model.jti = token.jti
                    }
                }
            })
            .catch((err: DrizzleQueryError) => {
                if ((err.cause as any).code === "23503") {
                    // err_msg = "Foriegn key error"
                    return undefined
                }
                logger.error({error:err}, "Error in inserting new Tokens")
                return undefined
            })
        
        
        await cache_set(format_key_by_id(cache_prefix, access_model.jti), access_model, 15)

        return {access_model, refresh_model}
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in JWT's new_tokens()")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
} 

const get_all = async (limit: number, offset: number) => {
    try {
        // We make 2 seperate queries, to get the data & the total_count of rows.
        // we can make 1 query, but we'll need to make manual transformation
        // so that we remove the count field from every item in the array.
        let {...rest} = getTableColumns(jwt_table) // select all columns, except created_at & updated_at.
        let [jwts, counts] = await Promise.all([
            await db.select({...rest}).from(jwt_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(jwt_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 


        return {
            data: jwts,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /jwts")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as JWTType
        }

        let jwt = await db.query.jwt_table.findFirst({
            columns: {
                jti: true,
                family_id: true,
                token_type: true,
                exp: true,
                iat: true,
                is_banned: true,
                used: true,

                user_id: true,
            },
            with: {
                user: {
                    columns: {
                        id: true,
                        username: true,
                        roles: true
                    }
                },
            },
            where: (jwt_table, { eq }) => eq(jwt_table.jti, id),
        })
        if (!jwt) {
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        return jwt
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /jwts/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }  
}

const update_one = async(id: string, data: any) => {
    try {        
        await db.update(jwt_table).set({...data}).where(eq(jwt_table.jti, id))
        
        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /jwts/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const ban_one_by_id = async(id: string, data: any) => {
    try {        
        await update_one(id, {is_banned: true})
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /jwts/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const ban_jwts_with_filters = async(user_id?: string, family_id?: string) => {
    try {        
        let {jti} = getTableColumns(jwt_table) // select all columns, except created_at & updated_at.
        let tokens = [] 
        if(user_id) {
            tokens = await db.select({jti}).from(jwt_table).where(eq(jwt_table.user_id, user_id))
            await db.update(jwt_table).set({is_banned: true}).where(eq(jwt_table.user_id, user_id))
        } else if(family_id) {
            tokens = await db.select({jti}).from(jwt_table).where(eq(jwt_table.family_id, family_id))
            await db.update(jwt_table).set({is_banned: true}).where(eq(jwt_table.family_id, family_id))
        } else {
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository", "Filter wasn't provided")
        }

        let cache_keys: string[] = []
        for(let token of tokens) {
            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, token.jti)
            cache_keys.push(cache_key)
        }
        await cache.del(cache_keys)    

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in banning JWTs with filters")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_one = async(id: string) => {
    try {       
    
        await db.delete(jwt_table).where(eq(jwt_table.jti, id))

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

const delete_user_jwts = async(user_id: string) => {
    try {       
        let {jti} = getTableColumns(jwt_table) // select all columns, except created_at & updated_at.
        let tokens = [] 
        
        tokens = await db.select({jti}).from(jwt_table).where(eq(jwt_table.user_id, user_id))
        await db.delete(jwt_table).where(eq(jwt_table.user_id, user_id))

        let cache_keys: string[] = []
        for(let token of tokens) {
            // Delete from cache after update to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, token.jti)
            cache_keys.push(cache_key)
        }
        await cache.del(cache_keys)    

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in banning user tokens")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const cleanup = async() => {
    try{    
        await db.delete(jwt_table)
        await cache.flushall(FlushMode.ASYNC)
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in jwt cleanup")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}



export const repository = {
    new_tokens,
    get_all,
    get_one_by_id,
    ban_one_by_id,
    ban_jwts_with_filters,
    delete_one,
    delete_user_jwts,
    cleanup,
}
