import { decode, sign, verify } from 'hono/jwt'
import { JWTPayload } from 'hono/utils/jwt/types';
import { ACCESS_JWT_PRIVATE_KEY, ACCESS_JWT_PUBLIC_KEY, REFRESH_JWT_PRIVATE_KEY, REFRESH_JWT_PUBLIC_KEY } from '../config.js'
import { createMiddleware } from 'hono/factory';
// 
import { RoleEnum, RoleEnumType, TokenType, TokenTypeEnum } from '../database/schemas.js';
import { HttpStatusCode } from '../utils/api.js';
import { logger } from '../utils/logger.js';
import { getDateInSec } from '../utils/time.js';
import {Claims} from "../schemas/jwt.js"

export async function sign_jwt(claims: Claims) {
    if (claims.token_type == "access") {
        return await sign(
            claims,
            ACCESS_JWT_PRIVATE_KEY,
            'RS256',
        );
    } else {
        return await sign(
            claims,
            REFRESH_JWT_PRIVATE_KEY,
            'RS256',
        );
    }
} 
export async function verify_jwt(token: string, type: TokenType = TokenTypeEnum.ACCESS) {
    try {
        let payload: JWTPayload
        if (type == "refresh") {
            payload =  await verify(token, REFRESH_JWT_PUBLIC_KEY, "RS256") 
        } else {
            payload =  await verify(token, ACCESS_JWT_PUBLIC_KEY, "RS256") 
        }
        return payload as Claims
    } catch(e) {
        logger.error(`Error verifing JWT, error: ${e}`)
        return null
    }
} 

//  Access & Refresh tokens exp field in minutes
export const ACCESS_EXP_MIN_DELTA = 15
export const REFRESH_EXP_MIN_DELTA =  60 * 24 * 7

export async function new_claims(
    token_data: {jti: string, family_id: string, token_type: TokenType, exp: Date, iat: Date},
    user?: Claims["user"], 
): Promise<Claims> {
    let claims: Claims
    if (token_data.token_type == "refresh") {
        claims = {
            jti: token_data.jti,
            family_id: token_data.family_id,
            token_type: "refresh",
            exp: getDateInSec(token_data.exp),
            iat: getDateInSec(token_data.iat)
        }
    } else {
        let permissions = await create_permissions(user?.roles || [])
        claims = {
            jti: token_data.jti,
            family_id: token_data.family_id,
            user,
            permissions,
            token_type: "access",
            exp: getDateInSec(token_data.exp),
            iat: getDateInSec(token_data.iat)
        }
    }

    return claims
}


export type OPType = "write" | "read"

export function create_permission(role: RoleEnumType, op: OPType = "read") {
    return role + ":" + op
}

export async function create_permissions(roles: RoleEnumType[]) {
    let permissions: string[] = []

    for(let role of roles) {
        let write_permission = create_permission(role, "write")
        permissions.push(write_permission)

        let read_permission = create_permission(role, "read")
        permissions.push(read_permission)
    }

    return permissions
}

export const check_if_banned = (authorized_list: string[], permissions: string[], op: OPType = "read") => {
    let is_banned = false

    for (let perm of permissions) {
        if (op == "write" && perm == create_permission(RoleEnum.BANNED, "write")) {
            is_banned = true
            break
        }
        else if (op == "read" && perm == create_permission(RoleEnum.BANNED, "read")) {
            is_banned = true
            break
        }
        continue
    }

    return is_banned
} 

export const check_if_permitted = (authorized_list: string[], permissions: string[], op: OPType = "read") => {
    let is_authorized = false
    let is_banned = false

    for (let perm of permissions) {
        if (op == "write" && perm == create_permission(RoleEnum.BANNED, "write")) {
            is_banned = true
            break
        }
        else if (op == "read" && perm == create_permission(RoleEnum.BANNED, "read")) {
            is_banned = true
            break
        }
        else {
            let index = authorized_list.indexOf(perm)
            if (index != -1) {
                is_authorized = true
            }
        }
    }

    if (is_banned) {
        is_authorized = false
    }

    return is_authorized
} 