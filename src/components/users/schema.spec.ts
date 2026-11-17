import { describe, expect, it, vi, test, beforeAll } from 'vitest';
///////
import { safeParse } from 'valibot';
import { RoleEnum } from '../../database/schemas.js';
import {signup_req, login_req, user_authorized_res, update_current_req, update_one_req} from './schema.js'
import { sign_token } from "../../utils/auth.js"

describe.concurrent("Testing Users' schema", async () => {
    const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
    const username = "username1"
    const password = "password1"
    const roles = [RoleEnum.NORMAL, RoleEnum.DBA]
    describe("Testing signup_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(signup_req, {username, password, roles});
            expect(res.success).toEqual(true);
            expect(res.output).toEqual({username, password, roles});  
        })
        test("Testing faliure", async() => {
            const res1 = safeParse(signup_req, {username, roles});
            expect(res1.success).toEqual(false);
            const res2 = safeParse(signup_req, {username, password, roles: 1251});
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing login_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(login_req, {username, password});
            expect(res.success).toEqual(true);
            expect(res.output).toEqual({username, password});  
        })
        test("Testing failure", async() => {
            const res1 = safeParse(login_req, {username, password: 121});
            expect(res1.success).toEqual(false);
            const res2 = safeParse(login_req, {username: 124152, password});
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing user_authorized_res schema", async () => {
        let user = {
            id,
            username,
            roles
        }
        let access_token = await sign_token(id, username, roles)
        test("Testing success", async() => {
            const res = safeParse(user_authorized_res, {user, access_token});
            expect(res.success).toEqual(true);
            expect(res.output).toEqual({user, access_token});  
        })        
        test("Testing failure", async() => {
            const res1 = safeParse(user_authorized_res, {user: {username, password, roles}, access_token});
            expect(res1.success).toEqual(false);
            const res2 = safeParse(user_authorized_res, {user: {username, roles}, access_token: 1221});
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing update_current_req schema", async () => {
        test("Testing success", async() => {
            const res1 = safeParse(update_current_req, {username, password});
            expect(res1.success).toEqual(true);
        })
        test("Testing failure", async() => {
            const res1 = safeParse(update_current_req, {username, password: 1221});
            expect(res1.success).toEqual(false);
            const res2 = safeParse(update_current_req, {username: 2112, password});
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing update_current_req schema", async () => {
        test("Testing success", async() => {
            const res1 = safeParse(update_one_req, {username, password, roles});
            expect(res1.success).toEqual(true);
        })
        test("Testing failure", async() => {
            const res1 = safeParse(update_one_req, {username, password: 1221, roles});
            expect(res1.success).toEqual(false);
            const res2 = safeParse(update_one_req, {username: 2112, password, roles});
            expect(res2.success).toEqual(false);
            const res3 = safeParse(update_one_req, {username, password, roles: "12512512"});
            expect(res3.success).toEqual(false);
        })
    })

})