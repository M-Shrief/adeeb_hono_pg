////
import { HttpStatusCode } from "../../utils/api.js"
import { APIError } from "../../utils/errors.js"
import { logger } from "../../utils/logger.js"
import { repository } from "./repository.js"

// const get_all = async(limit: number, offset: number) => {} 
const get_one_by_id = async(id: string) => {
    try {
        let repo_result = await repository.get_one_by_id(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /adeebs/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 


export const service = {
    // get_all
    get_one_by_id
}