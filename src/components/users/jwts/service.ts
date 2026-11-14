// /////
import { logger } from '../../../utils/logger.js';
import { Claims } from "../../../schemas/jwt.js";
import { new_claims, sign_jwt, verify_jwt } from "../../../auth//jwt.js"
import * as repository from "./repository.js"
import { APIError } from '../../../utils/errors.js';
import { HttpStatusCode } from '../../../utils/api.js';


export const new_tokens = async (user: Claims["user"], family_id?: string) => {
    const {access_model, refresh_model} = await repository.new_tokens(user, family_id)
    let access_claims = await new_claims(
        {
            jti: access_model.jti, 
            family_id: access_model.family_id, 
            token_type: access_model.token_type, 
            exp: access_model.exp, 
            iat: access_model.iat,
        },
        user
    )
    let refresh_claims = await new_claims(
        {
            jti: refresh_model.jti, 
            family_id: refresh_model.family_id, 
            token_type: refresh_model.token_type, 
            exp: refresh_model.exp, 
            iat: refresh_model.iat,
        },
        user
    )

    let access_token = await sign_jwt(access_claims)
    let refresh_token = await sign_jwt(refresh_claims)
    return {access_token, refresh_token}
}

export const refresh = async (token: string) => {
    let token_claims = await verify_jwt(token, "refresh") 
    if(!token_claims) {
        throw new APIError(HttpStatusCode.UNAUTHORIZED, "service")
    }
    let token_model = await repository.get_one_by_id(token_claims.jti)

    const {access_model, refresh_model} = await repository.new_tokens(token_model.user, token_model.family_id)
    let access_claims = await new_claims(
        {
            jti: access_model.jti, 
            family_id: access_model.family_id, 
            token_type: access_model.token_type, 
            exp: access_model.exp, 
            iat: access_model.iat,
        },
        token_model.user
    )
    let refresh_claims = await new_claims(
        {
            jti: refresh_model.jti, 
            family_id: refresh_model.family_id, 
            token_type: refresh_model.token_type, 
            exp: refresh_model.exp, 
            iat: refresh_model.iat,
        },
        token_model.user
    )

    let access_token = await sign_jwt(access_claims)
    let refresh_token = await sign_jwt(refresh_claims)
    return {access_token, refresh_token}
}