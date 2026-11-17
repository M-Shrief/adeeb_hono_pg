import { describe, expect, it, vi, test, beforeEach, afterEach } from 'vitest';
///////
import { RoleEnum } from '../../database/schemas.js';
import { sign_token } from "../../utils/auth.js"
import { service } from './service.js';
import { repository } from './repository.js';
import { APIError } from '../../utils/errors.js';
import { HttpStatusCode } from '../../utils/api.js';


describe.concurrent("Testing Users' service", async () => {
    const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
    const username = "username1"
    const password = "password1"
    const roles = [RoleEnum.NORMAL]
    const admin_roles = [RoleEnum.NORMAL, RoleEnum.DBA]
    const user = {id, username, roles}
    let access_token = await sign_token(id, username, roles, 2)
    let admin_token = await sign_token(id, username, admin_roles, 2)
    let auth_header = `Bearer ${access_token}`
    let admin_auth_header = `Bearer ${admin_token}`
    let get_data_result = {
        data: [user, user],
        limit: 2,
        offset: 0,
        total_count: 10
    } 
    describe("Testing get_all()", async () => {
        afterEach(() => {
            vi.clearAllMocks();
            vi.restoreAllMocks();
            vi.resetAllMocks();
            vi.resetModules();
        });
        test("Success Test", async() => {
            vi.spyOn(repository, "get_all").mockResolvedValueOnce(get_data_result)
            await expect(service.get_all(admin_auth_header,2,0)).resolves.toEqual(get_data_result)
        })
        test("Fail Test: APIError=401", async() => {
            vi.spyOn(repository, "get_all").mockResolvedValueOnce(get_data_result)
            await expect(service.get_all(auth_header,2,0)).rejects.toThrow(new APIError(HttpStatusCode.UNAUTHORIZED, "service"))
        })
        test("Fail Test: APIError=400", async() => {
            vi.spyOn(repository, "get_all").mockThrowOnce(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.get_all(admin_auth_header,2,0)).rejects.toThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
        })
    })

    // describe("Testing get_one_by_id()", async () => {
    //     afterEach(() => {
    //         vi.clearAllMocks();
    //         vi.restoreAllMocks();
    //         vi.resetAllMocks();
    //         vi.resetModules();
    //     });

    //     test("Testing success", async() => {
    //         vi.spyOn(repository, "get_one_by_id").mockResolvedValueOnce(user)
    //         await expect(service.get_one_by_id(null, admin_auth_header)).resolves.toEqual(user)
    //         await expect(service.get_one_by_id(id, admin_auth_header)).resolves.toEqual(user)
    //     })
    // })
    // describe("Testing signup_req", async () => {
    //     test("Testing success", async() => {})
    //     test("Fail Test: APIError=400", async() => {})
    // })
})