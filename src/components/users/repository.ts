import { sql, getTableColumns, eq, DrizzleQueryError } from 'drizzle-orm';
////////////
import { logger } from '../../utils/logger.js';
import { db } from "../../database/index.js"
import { RoleEnum, user_table } from "../../database/schemas.js"
// import { User } from './types.js';
import { APIError } from '../..//utils/errors.js'
import { HttpStatusCode } from '../../utils/api.js';
import { hash_password, RoleEnumType } from '../../utils/auth.js';


const get_all = async (limit: number, offset: number) => {
    try {
        let { id, username, roles} = getTableColumns(user_table) // select all columns, except created_at & updated_at.
        let [users, counts] = await Promise.all([
            await db.select({ id, username, roles }).from(user_table).limit(limit).offset(offset),
            await db.select({total_count: sql<number>`count(*) OVER()`.mapWith(Number)}).from(user_table)
        ])
        let total_count = counts[0] ? counts[0].total_count : 0 

        return {
            data: users,
            limit, 
            offset, 
            total_count: total_count
        }
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in GET /users")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const get_one_by_id = async (id: string)  => {
    try {

        let user = await db.query.user_table.findFirst({
            columns: {
                id: true,
                username: true,
                roles: true,
            },
            where: (user_table, { eq }) => eq(user_table.id, id),
        })
        if (!user) {
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }
        return user
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        } else {
            logger.error({error:e}, "Error in GET /users/:id")
            throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
        }
    }
}

const get_one_for_login = async(username: string) => {
    try {
        let existing_user = await db.query.user_table.findFirst({
            columns: {
                id: true,
                username: true,
                password: true,
                roles: true,
            },
            where: (user_table, { eq }) => eq(user_table.username, username),
        })

        if (!existing_user) {
            throw new APIError(HttpStatusCode.NOT_FOUND, "repository")
        }


        return existing_user
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in querying user by username for login request")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const signup = async(data: any) => {
    try {
        let hashed_pass = await hash_password(data.password)

        // Ensuring integrity, by removing duplicates and having Normal role as a must.
        let roles = new Set<RoleEnumType>(data.roles as RoleEnumType[])
        roles.add(RoleEnum.NORMAL)

        let new_user = await db
            .insert(user_table)
            .values({username: data.username, password: hashed_pass, roles: [...roles]})
            .onConflictDoNothing({ target: [user_table.username] })
            .returning()
            .then(res => res[0])
        
        if (!new_user) {
            throw new APIError(HttpStatusCode.CONFLICT, "repository", "User already exists")
        }        
        return new_user
    } catch(e) {
        if(e instanceof APIError) {
            throw e
        }
        logger.error({error:e}, "Error in POST /users/signup")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}


const update_current_user = async(id: string, data: any) => {
    try {        
        let hashed_pass = undefined
        if (data.password) {
            hashed_pass = await hash_password(data.password)
        }
        // set() ignores fields with undefined value, so we don't need conditions
        await db.update(user_table).set({username: data.username, password: hashed_pass, updated_at: sql`NOW()`}).where(eq(user_table.id, id))
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /users/me")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    

const update_user_by_id = async(id: string, data: any) => {
    try {        
        let hashed_pass = undefined
        if (data.password) {
            hashed_pass = await hash_password(data.password)
        }
        let roles = undefined
        if(data.roles) {
            // Ensuring integrity, by removing duplicates and having Normal role as a must.
            roles = new Set<RoleEnumType>(data.roles as RoleEnumType[])
            roles.add(RoleEnum.NORMAL)
            roles = [...roles]
        }
        // set() ignores fields with undefined value, so we don't need conditions
        await db.update(user_table).set({username: data.username, password: hashed_pass, roles: roles, updated_at: sql`NOW()`}).where(eq(user_table.id, id))

        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23505") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        logger.error({error: e}, "Error in PUT /users/:id")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}

const ban_user_by_id = async(id: string) => {
    try {        
        const query = sql`UPDATE users set roles = (select array_agg(distinct e) from unnest(array_append(users.roles, 'Banned'::roles_enum)) e) WHERE id = ${id}`;
        await db.execute(query);
        return null
    } catch(e: any) {
        logger.error({error: e}, "Error in PUT /users/:id/ban")
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}


const delete_one = async(id: string) => {
    try {        
        await db.delete(user_table).where(eq(user_table.id, id))
        return null
    } catch(e: any) {
        if ((e.cause as any).code === "23503") {
            throw new APIError(HttpStatusCode.CONFLICT, "repository")
        }
        throw new APIError(HttpStatusCode.BAD_REQUEST, "repository")
    }
}    


export const repository = {
    get_all,
    get_one_by_id,
    signup,
    get_one_for_login,
    update_current_user,
    update_user_by_id,
    ban_user_by_id,
    delete_one,
}
