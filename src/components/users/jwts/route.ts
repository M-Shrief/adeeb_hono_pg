import { Hono } from 'hono';
import { describeRoute } from "hono-openapi";
import { getCookie} from 'hono/cookie'
///////
import { APIError } from '../../../utils/errors.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../../utils/api.js';
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../../schemas/api.js';
import { set_refresh_token_cookie } from '../../../auth/utils.js';
import { auth_header_validator, id_param_validator, json_validator, query_validator, cookie_validator } from '../../../utils/validators.js'
import { refresh_response_schema, refresh_cookie_schema } from './scheme.js';
import {service} from "./service.js"
import { logger } from '../../../utils/logger.js';
import { one_schema } from '../../../schemas/jwt.js';
import { auth_error_response_schema, AuthError, AuthError_ReasonEnum, new_auth_error_response} from '../../../auth/errors.js';

export const jwts_route = new Hono()  

jwts_route.post(
    "/jwts/refresh",
    describeRoute({
        tags: ["JWTs"],
        summary: "Refresh",
        description: "Rotate JWTs",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", refresh_response_schema),
           ...get_described_route(HttpStatusCode.UNAUTHORIZED, "Not Authorized", auth_error_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    cookie_validator(refresh_cookie_schema),
    async(c) => {
        try {
            let token = getCookie(c, "refresh_token")
            if (!token) {
                throw new AuthError(AuthError_ReasonEnum.INVALID_TOKEN, "controller")
            }
            let {access_token, refresh_token}  = await service.refresh(token)

            await set_refresh_token_cookie(c, refresh_token)
            return c.json({access_token}, HttpStatusCode.OK)
        } catch(e) {
            if(e instanceof AuthError) {
                return new_auth_error_response(c, e.reason) 
            }
            if(e instanceof APIError) {
                switch(e.status_code) {
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error:e}, "Error in POST /jwts/refresh")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

