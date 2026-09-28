import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
/////
import { db } from "../../database/index.js"
import { adeeb_table } from "../../database/schemas.js"
import {one_schema} from "../../schemas/adeeb.js"
import { get_one_res, create_many_req, create_many_res, create_one_req, create_one_res, update_req } from './schema.js'
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
import { auth_header_validator, id_param_validator, json_validator, query_validator } from '../../utils/validators.js'
import { base_response_schema, queries_schema_for_get_all_req, get_all_schema, InvalidItemType} from '../../schemas/api.js';
import { HttpStatusCode, get_described_route, describe_jwt_security } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { verify_adminstrator } from '../../utils/auth.js';
import {service} from "./service.js"
import { APIError } from '../../utils/errors.js';

export const adeeb_route = new Hono()  

const cache_prefix = "adeebs" 


adeeb_route.get(
    "/adeebs",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Get All",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get All Adeebs", get_all_schema(one_schema)),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    query_validator(queries_schema_for_get_all_req),
        async(c) => {
        try {
            let limit = Number(c.req.query('limit'))
            let offset = Number(c.req.query('offset'))
            let adeebs = await service.get_all(limit, offset) 
            return c.json(adeebs, HttpStatusCode.OK)
        } catch(e) {
            if(e instanceof APIError) {
                return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
            }
            // if the error originated from the route/controller then log it:
            logger.error({error:e}, "Error in GET /adeebs")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.get(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Get One",
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Get Adeeb", get_one_res),
           ...get_described_route(HttpStatusCode.NOT_FOUND, "Adeeb's not Found", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    id_param_validator(),
    async(c) => {
        try {
            let id = c.req.param("id")
            let adeeb = await service.get_one_by_id(id)
            return c.json(adeeb, HttpStatusCode.OK)
        } catch(e) {
            if(e instanceof APIError) {
                switch(e.status_code) {
                    case HttpStatusCode.NOT_FOUND:
                        return c.json({message: "Adeeb's not Found"}, HttpStatusCode.NOT_FOUND)
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error:e}, "Error in GET /adeebs/:id")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.post(
    "/adeebs",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Create One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful added Adeeb", create_one_res),
           ...get_described_route(HttpStatusCode.CONFLICT, "Adeeb already exists", base_response_schema),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_one_req, "Invalid data for Adeeb"),
    async(c) => {
        try {
            let new_data = await c.req.json()
            let new_adeeb = await service.create_one(new_data)
            return c.json(new_adeeb, HttpStatusCode.CREATED)
        } catch(e) {
            if(e instanceof APIError) {
                switch(e.status_code) {
                    case HttpStatusCode.CONFLICT:
                        return c.json({message: e.message}, HttpStatusCode.CONFLICT)
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error:e}, "Error in POST /adeebs")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.post(
    "/adeebs/many",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Create Many",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.OK, "Successful response", create_many_res),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request", base_response_schema)
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    json_validator(create_many_req, "Invalid data, can't be used to create many Adeebs"),
        async(c) => {
        try {
            let new_data = await c.req.json()
            let new_adeebs = await service.create_many(new_data)
            return c.json(new_adeebs, HttpStatusCode.CREATED)
        } catch(e) {
            if(e instanceof APIError) {
                switch(e.status_code) {
                    case HttpStatusCode.BAD_REQUEST:
                        return c.json({message: e.message}, HttpStatusCode.BAD_REQUEST)
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error:e}, "Error in POST /adeebs/many")
            return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.put(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Update One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.NO_CONTENT, "Updated Successfully"),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request, try again later.", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    id_param_validator(),
    json_validator(update_req, "Invalid data for update"),
    async(c) => {
        try {
            let id = c.req.param("id")
            let data = await c.req.json()
            
            await service.update_one(id, data)
            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e: any) {
            if(e instanceof APIError) {
                switch(e.status_code) {
                    case HttpStatusCode.CONFLICT:
                        return c.json({message: "Already Exists"}, HttpStatusCode.CONFLICT)
                    default:
                        return c.json({message: "Unknown error, try again later"}, HttpStatusCode.BAD_REQUEST)
                }
            }
            logger.error({error: e}, "Error in PUT /adeebs/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)

adeeb_route.delete(
    "/adeebs/:id",
    describeRoute({
        tags: ["Adeebs"],
        summary: "Delete One",
        ...describe_jwt_security,
        responses: {
           ...get_described_route(HttpStatusCode.NO_CONTENT, "Deleted Successfully"),
           ...get_described_route(HttpStatusCode.BAD_REQUEST, "Bad Request, try again later.", base_response_schema),
        },
    }),
    auth_header_validator(),
    verify_adminstrator(),
    id_param_validator(),
    async (c) => {
        try {
            let id = c.req.param("id")
            
            await db.delete(adeeb_table).where(eq(adeeb_table.id, id))

            // Delete from cache after delete to prevent showing old data
            let cache_key = format_key_by_id(cache_prefix, id)
            await cache_del(cache_key)

            return c.newResponse(null, HttpStatusCode.NO_CONTENT)
        } catch(e) {
            logger.error({error: e}, "Error Delete /adeebs/:id")
            return c.json({message: "Bad Request, try again later."}, HttpStatusCode.BAD_REQUEST)
        }
    }
)
