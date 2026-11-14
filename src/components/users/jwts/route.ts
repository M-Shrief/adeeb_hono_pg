import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import {
  getCookie,
  setCookie,
} from 'hono/cookie'
///////
import { APIError } from '../../../utils/errors.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../../utils/api.js';
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../../schemas/api.js';
import { set_refresh_token_cookie, verify_adminstrator_middleware } from '../../../auth/utils.js';
import { auth_header_validator, id_param_validator, json_validator, query_validator, cookie_validator } from '../../../utils/validators.js'
import { refresh_response_schema, refresh_cookie_schema } from './scheme.js';
import * as service from "./service.js"
import { logger } from '../../../utils/logger.js';

export const jwts_route = new Hono()  

jwts_route.post(
    "/jwts/refresh",
    describeRoute({
        tags: ["JWTs"],
        summary: "Rotate JWTs",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", refresh_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    cookie_validator(refresh_cookie_schema),
    async(c) => {
        try {
            let token = getCookie(c, "refresh_token")
            if (!token) {
                throw new APIError(HttpStatusCode.UNAUTHORIZED, "controller")
            }
            let refresh_result = await service.refresh(token)
            if (!refresh_result) {
                throw new APIError(HttpStatusCode.UNAUTHORIZED, "controller")
            }
            let {access_token, refresh_token} = refresh_result
            await set_refresh_token_cookie(c, refresh_token)
            return c.json({access_token}, HttpStatusCode.OK)
        } catch(e) {
            if(e instanceof APIError) {
                switch(e.status_code) {
                    case HttpStatusCode.UNAUTHORIZED:
                        return c.json({message: "Not Authorized"}, HttpStatusCode.UNAUTHORIZED)
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error:e}, "Error in POST /jwts/refresh")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

