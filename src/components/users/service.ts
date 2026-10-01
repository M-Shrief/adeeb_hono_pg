////
import { HttpStatusCode } from "../../utils/api.js"
import { APIError } from "../../utils/errors.js"
import { logger } from "../../utils/logger.js"
import { repository } from "./repository.js"

const get_all = async(limit: number, offset: number) => {
    try {
        let repo_result = await repository.get_all(limit, offset)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /users")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }    
} 

const get_one_by_id = async(id: string) => {
    try {
        let repo_result = await repository.get_one_by_id(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /users/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 

const get_one_for_login = async(username: string) => {
    try {
        let repo_result = await repository.get_one_for_login(username)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in querying user by username for login request")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 


const signup = async(new_data: any) => {
    try {
        let repo_result = await repository.signup(new_data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in POST /users")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 

const update_current_user = async(id: string, data: any) => {
    try {
        let repo_result = await repository.update_current_user(id, data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in PUT /users/me")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const update_user_by_id = async(id: string, data: any) => {
    try {
        let repo_result = await repository.update_user_by_id(id, data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in PUT /users/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const ban_user_by_id = async(id: string) => {
    try {
        let repo_result = await repository.ban_user_by_id(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in PUT /users/:id/ban")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const delete_one = async(id: string) => {
    try {
        let repo_result = await repository.delete_one(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

export const service = {
    get_all,
    get_one_by_id,
    signup,
    get_one_for_login,
    update_current_user,
    update_user_by_id,
    ban_user_by_id,
    delete_one,
}