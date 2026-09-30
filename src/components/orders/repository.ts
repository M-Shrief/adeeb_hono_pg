import { Hono } from 'hono';
import {
  describeRoute,
} from "hono-openapi";
import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { order_table, OrderStatusEnum, prints_table } from "../../database/schemas.js"
import { cache_del, cache_get, cache_set, format_key_by_id } from "../../cache/utils.js"
// import { prose_qoute } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { InvalidItemType } from '../../schemas/api.js';
import { Order } from './types.js';

const cache_prefix = "orders" 

const get_all = async (limit: number, offset: number) => {
    try {
        let [orders, counts] = await Promise.all([
            await db.query.order_table.findMany({
                columns: {
                    created_at: false,
                    updated_at: false,
                },
                with: {
                    prints: {
                        columns: {
                            // already got them in order
                            user_id: false, 
                            order_id: false
                        }
                    }
                },
                limit: limit,
                offset: offset,
            }),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(order_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: orders,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /orders")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_user_orders = async (user_id: string, limit: number, offset: number) => {
    try {
        let [orders, counts] = await Promise.all([
            await db.query.order_table.findMany({
                columns: {
                    created_at: false,
                    updated_at: false,
                },
                with: {
                    prints: {
                        columns: {
                            // already got them in order
                            user_id: false, 
                            order_id: false
                        }
                    }
                },
                limit: limit,
                offset: offset,
                where: (order_table, { eq }) => eq(order_table.user_id, user_id),
            }),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(order_table)
        ])
        
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: orders,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /orders/me")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}


const get_one_by_id = async (id: string) => {
    try {
        let cache_key = format_key_by_id(cache_prefix, id)
        let cache_res = await cache_get(cache_key)

        if(cache_res) {
            return cache_res as Order
        }
        let order = await db.query.order_table.findFirst({
                columns: {
                    created_at: false,
                    updated_at: false,
                },
                with: {
                    prints: {
                        columns: {
                            // already got them in order
                            user_id: false, 
                            order_id: false
                        }
                    }
                },
                where: (order_table, { eq }) => eq(order_table.id, id),
            })
        if (!order) {
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        await cache_set(cache_key, order)
        return order
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /orders/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const check_order = async(order_id: string) => {
    try {
        let existing_order = await db.query.order_table.findFirst({
            columns: {
                id: true,
                user_id: true,
                is_updateable: true,
            },
            where: (order_table, { eq }) => eq(order_table.id, order_id),
        })

        if (!existing_order) {
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        return existing_order
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in checking order existence")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_order = async(data: any) => {
    try {
        let err_msg = null
        let delivery_schedule = new Date()
        delivery_schedule.setDate(delivery_schedule.getDate() + 7);
        let new_order = await db
            .insert(order_table)
            .values({ 
                name: data.name,
                phone: data.phone,
                address: data.address,
                reviewed: false,
                is_updateable: true,
                delivery_schedule: delivery_schedule,
                status: OrderStatusEnum.IN_PROGRESS,
                user_id: data.user_id
            })
            // .onConflictDoNothing()
            .returning()
            .then(res => res[0])
            .catch((err: DrizzleQueryError) => {
                if ((err.cause as any).code === "23503") {
                    err_msg = "Foriegn key error"
                }
                return undefined
            })
        if (!new_order) {
            if(!err_msg) {
                err_msg = "Error inserting Order, try again later"
            }
            throw new APIError(HttpStatusCode.CONFLICT, "repository", err_msg)
        }
        let prints_data = data.prints.map((item: any) => { return {...item, user_id: new_order.user_id, order_id: new_order.id}})
        let new_prints = await db
            .insert(prints_table)
            .values([...prints_data])
            .onConflictDoNothing()
            .returning()
        // No need to handle foreign key error for the order_id & user_id
        // as we handled them above

        return {...new_order, prints: new_prints}
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /orders")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_orders = async(data: any[]) => {
    try {
        let new_orders: any[] = []
        let invalid_items: InvalidItemType[] = []

        let delivery_schedule = new Date()
        delivery_schedule.setDate(delivery_schedule.getDate() + 7);

        for (let [index, order] of data.entries()) {
            let err_msg = null;
            let new_order = await db
                .insert(order_table)
                .values({ 
                    name: order.name,
                    phone: order.phone,
                    address: order.address,
                    reviewed: false,
                    is_updateable: true,
                    delivery_schedule: delivery_schedule,
                    status: OrderStatusEnum.IN_PROGRESS,
                    user_id: order.user_id
                })
                .onConflictDoNothing()
                .returning()
                .then(res => res[0])
                .catch((err: DrizzleQueryError) => {
                    if ((err.cause as any).code === "23503") {
                        err_msg = "Foriegn key error"
                    }
                    return undefined
                })

            if(!new_order) {
                if(!err_msg) {
                    err_msg = "Error inserting Order, try again later"
                }   
                invalid_items.push({item_index: index, message: "Error inserting order, try again later"})
                continue
            }

            let prints_data = order.prints.map((item: any) => { return {...item, user_id: new_order.user_id, order_id: new_order.id}})
            let new_prints = await db
                .insert(prints_table)
                .values([...prints_data])
                .onConflictDoNothing()
                .returning()
            // No need to handle foreign key error for the order_id & user_id
            // as we handled them before
            new_orders.push({...new_order, prints: new_prints})
        }

        return {created_items: new_orders, success_count: new_orders.length, invalid_items}
    } catch(e) {
        logger.error({error:e}, "Error in POST /orders/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_print = async(order_id: string, user_id: string | null, data: any) => {
    try {
        let print_data = {...data, user_id: user_id, order_id: order_id}
        let new_print = await db
            .insert(prints_table)
            .values(print_data)
            .onConflictDoNothing()
            .returning()
            .then(res => res[0])


        return new_print
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository", "Foreign Key Error")
        }
        logger.error({error:e}, "Error in POST /orders/{id}/prints")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const create_prints = async(order_id: string, user_id: string | null, data: any[]) => {
    try {
        let new_prints: any[] = []
        let invalid_items: InvalidItemType[] = []
        let prints_data = data.map((item: any) => { return {...item, user_id, order_id}})
        for(let [index, item] of prints_data.entries()) {
            let err_msg = null
            let new_print = await db
                .insert(prints_table)
                .values(item)
                .onConflictDoNothing()
                .returning()
                .then(res => res[0])
                .catch((err: DrizzleQueryError) => {
                    if ((err.cause as any).code === "23503") {
                        err_msg = "Foreign Key Error"
                    }
                    return undefined
                })


            if(!new_print) {
                if(err_msg == null) {
                    err_msg = "Error inserting Print, try again later" 
                }
                invalid_items.push({item_index: index, message: err_msg})
                continue
            }
            new_prints.push(new_print)
        }
        return {created_items: new_prints, success_count: new_prints.length, invalid_items}

    } catch(e) {
        logger.error({error:e}, "Error in POST /orders/{id}/prints/many")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const update_order = async(id: string, data: any) => {
    try {        
        // Ensuring data integrity

        // If the order is aborted or marked as completed, then we make sure that is_updateable is False
        if (data.status == OrderStatusEnum.COMPLETED || data.status == OrderStatusEnum.ABORTED) {
            data.is_updateable = false
        } else if (data.status == OrderStatusEnum.IN_PROGRESS) {
            data.is_updateable = true
        } else if (data.is_updateable) { 
        // if it want to make is_updateable true, then we make sure status == "in progress".
            data.status = OrderStatusEnum.IN_PROGRESS
        }

        await db.update(order_table).set({...data, updated_at: sql`NOW()`}).where(eq(order_table.id, id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /orders/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const update_print = async(order_id: string, print_id: string, data: any) => {
    try {
        await db.update(prints_table).set({...data, updated_at: sql`NOW()`}).where(eq(prints_table.id, print_id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, order_id)
        await cache_del(cache_key)

    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /orders/:id/prints/{id}")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const delete_order = async(id: string) => {
    try {        
        await db.delete(prints_table).where(eq(prints_table.order_id, id))
        await db.delete(order_table).where(eq(order_table.id, id))

        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, id)
        await cache_del(cache_key)
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /orders/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const delete_print = async(order_id: string, print_id: string) => {
    try {        
        await db.delete(prints_table).where(eq(prints_table.order_id, print_id))
        // Delete from cache after update to prevent showing old data
        let cache_key = format_key_by_id(cache_prefix, order_id)
        await cache_del(cache_key)
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error Delete /orders/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    


export const repository = {
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
