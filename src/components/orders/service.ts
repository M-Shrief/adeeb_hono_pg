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
            logger.error({error:e}, "Error in GET /orders")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }    
} 

const get_user_orders = async(user_id: string, limit: number, offset: number) => {
    try {
        let repo_result = await repository.get_user_orders(user_id, limit, offset)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /orders/me")
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
            logger.error({error:e}, "Error in GET /orders/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 

const check_order = async(id: string) => {
    try {
        let repo_result = await repository.check_order(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /orders/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 


const create_order = async(new_data: any) => {
    try {
        let repo_result = await repository.create_order(new_data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in POST /orders")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 

const create_orders = async(new_data: any[]) => {
    try {
        let repo_result = await repository.create_orders(new_data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in POST /orders/many")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const create_print = async(order_id: string, user_id: string | null, new_data: any) => {
    try {
        let repo_result = await repository.create_print(order_id, user_id, new_data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in POST /orders/:id/prints")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
} 

const create_prints = async(order_id: string, user_id: string | null, new_data: any[]) => {
    try {
        let repo_result = await repository.create_prints(order_id, user_id, new_data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in POST /orders/:id/prints/many")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const update_order = async(id: string, data: any) => {
    try {
        let repo_result = await repository.update_order(id, data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in PUT /orders/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const update_print = async(order_id: string, print_id: string, data: any) => {
    try {
        let repo_result = await repository.update_print(order_id, print_id, data)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in PUT /orders/:order_id/prints/:print_id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const delete_order = async(id: string) => {
    try {
        let repo_result = await repository.delete_order(id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in DELETE /orders/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

const delete_print = async(order_id: string, print_id: string) => {
    try {
        let repo_result = await repository.delete_print(order_id, print_id)
        return repo_result
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in DELETE /orders/:order_id/prints/:print_id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "service")
        }
    }
}

export const service = {
    get_all,
    get_user_orders,
    get_one_by_id,
    check_order,
    create_order,
    create_orders,
    create_print,
    create_prints,
    update_order,
    update_print,
    delete_order,
    delete_print,
}
