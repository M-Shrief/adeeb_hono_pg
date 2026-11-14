import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
import {randomUUID} from "node:crypto"
// /////
import { logger } from '../../../utils/logger.js';
import { db } from "../../../database/index.js"
import { jwt_table, TokenType, TokenTypeEnum } from "../../../database/schemas.js";
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../../cache/utils.js"
import { Claims } from "../../../schemas/jwt.js";
import * as time_utils from "../../../utils/time.js"
import {ACCESS_EXP_MIN_DELTA, REFRESH_EXP_MIN_DELTA, new_claims, sign_jwt} from "../../../auth/jwt.js"
import { APIError } from '../../../utils/errors.js'
import { HttpStatusCode } from '../../../utils/api.js';
import { JWTType } from './scheme.js';

const cache_prefix = "jwts" 

/**
 * return JWT claims for access & refresh token respectively
 */
const new_tokens = async(user: Claims["user"], family_id?: string) => {
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
                    // access_model.exp = time_utils.getDateInSec(token.exp)
                    // access_model.iat = time_utils.getDateInSec(token.iat)
                } else {
                    refresh_model.jti = token.jti
                    // refresh_model.exp = time_utils.getDateInSec(token.exp)
                    // refresh_model.iat = time_utils.getDateInSec(token.iat)
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
    
    
    // await cache_set(format_key_by_id(cache_prefix, access_model.jti), access_model, 15)

    return {access_model, refresh_model}
    // let access_claims = await new_claims(
    //     {
    //         jti: access_model.jti, 
    //         family_id: access_model.family_id, 
    //         token_type: access_model.token_type, 
    //         exp: access_model.exp, 
    //         iat: access_model.iat,
    //     },
    //     user
    // )
    // let refresh_claims = await new_claims(
    //     {
    //         jti: refresh_model.jti, 
    //         family_id: refresh_model.family_id, 
    //         token_type: refresh_model.token_type, 
    //         exp: refresh_model.exp, 
    //         iat: refresh_model.iat,
    //     },
    //     user
    // )

    // let access_token = await sign_jwt(access_claims)
    // let refresh_token = await sign_jwt(refresh_claims)
    // return {access_token, refresh_token}
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

export const repository = {
    new_tokens,
    get_one_by_id,
}
