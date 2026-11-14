import { InferInput ,array, maxLength, maxValue, minValue, number, object, optional, pipe, string, toNumber } from "valibot";
////
import { RoleEnumType, TokenType } from "../../../database/schemas.js";

export type JWTType = {
 jti: string;
 family_id: string;
 token_type: TokenType;
 exp: Date;
 iat: Date;
 used: boolean;
 is_banned: boolean;
 user_id: string;
 user: {
 id: string;
 username: string;
 roles: RoleEnumType[];
 };
}


export const refresh_cookie_schema = object({
    refresh_token: pipe(string())
})

export const refresh_response_schema = object({access_token: string()})
