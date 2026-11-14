import { Context } from 'hono';
import { setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory';
import { JWTPayload } from 'hono/utils/jwt/types';
// 
import { RoleEnum } from '../database/schemas.js';
import { HttpStatusCode } from '../utils/api.js';
import {create_permission, check_if_permitted, type OPType, verify_jwt, ACCESS_EXP_MIN_DELTA, REFRESH_EXP_MIN_DELTA } from "./jwt.js"
import { type Claims } from '../schemas/jwt.js';

export async function set_refresh_token_cookie(c: Context, refresh_token: string){
    setCookie(
        c, 
        'refresh_token', 
        refresh_token,
        {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 60 * REFRESH_EXP_MIN_DELTA,
        }
    )
    return c
}


export const check_if_adminstrator = (user_permissions: string[], op: OPType = "read"): boolean => {
    let authorized_list = [
        create_permission(RoleEnum.MANAGMENT, op),
        create_permission(RoleEnum.DBA, op),
        create_permission(RoleEnum.ANALYTICS, op),
    ]

    return check_if_permitted(authorized_list, user_permissions, op)
}

export const check_item_ownership = (item_owner_id: string | null, claims: Claims) => {    
    if (!item_owner_id) { // if it doesn't belong to signed up user, 
        return false
    }
    if (!claims.user) {
        return false
    }
    if (item_owner_id != claims.user.id) { // if the user is not the owner of the order
        return false
    }
    return true
}

/**
 * A middleware used to check if adminstrator authority in WRITE operations in domain components, 
 * like: POST/PUT/DELETE operations in adeebs component.
 */
export const verify_adminstrator_middleware = () =>
  createMiddleware(async (c, next) => {
    let auth_header = c.req.header("Authorization")
    if (!auth_header) {
        return c.json({ message: "Not Authorized"}, HttpStatusCode.UNAUTHORIZED) 
    }

    let payload = await verify_jwt(auth_header.slice(7)) // header was already validated
    if (!payload) {
        return c.json({ message: "Not Authorized"}, HttpStatusCode.UNAUTHORIZED) 
    }

    let permissions = payload["permissions"] as string[]
    let is_adminstrator = check_if_adminstrator(permissions, "write")
    if (!is_adminstrator) {
        return c.json({ message: "Not Authorized"}, HttpStatusCode.UNAUTHORIZED) 
    }

    await next();
  });
