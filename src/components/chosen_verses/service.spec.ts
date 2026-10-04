import { describe, expect, it, vi, test, beforeAll } from 'vitest';
////
import { service } from './service.js';
import { repository } from './repository.js';
import { APIError } from '../../utils/errors.js';
import { HttpStatusCode } from '../../utils/api.js';
import { TimePeriodEnum } from '../../database/schemas.js';


describe.concurrent("Testing ChosenVerse' service", async () => {
    describe("Testing get_all()", async () => {
        const id = '0343952d-58fc-4f56-b2b6-fc04731de5ce';
        const adeeb_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        const poem_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        let chosen_verse = {
            id,
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id,
            poem_id: poem_id
        }
        let get_data_result = {
            data: [chosen_verse, chosen_verse],
            limit: 2,
            offset: 0,
            total_count: 10
        } 
        test("Success Test", async() => {
            vi.spyOn(repository, "get_all").mockResolvedValue(get_data_result)
            await expect(service.get_all(2,0)).resolves.toEqual(get_data_result)
        })

        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "get_all").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.get_all(2,0)).rejects.toThrow(bad_req_err)
        })
    })
    describe("Testing get_one_by_id()", async () => {
        const id = '0343952d-58fc-4f56-b2b6-fc04731de5ce';
        const adeeb_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        const poem_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        const adeeb = {
            id: adeeb_id,
            name: 'عنترة بن شداد',
        }
        const poem = {
            id: poem_id,
            intro: 'حَكِّم سُيوفَكَ في رِقابِ العُذَّلِ',
        }
        let chosen_verse = {
            id,
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id,
            poem_id: poem_id,
            adeeb,
            poem,
        }
        test("Success Test", async() => {
            vi.spyOn(repository, "get_one_by_id").mockResolvedValue(chosen_verse)
            await expect(service.get_one_by_id(id)).resolves.toEqual(chosen_verse)
        })

        test("Fail Test: APIError=404", async() => {
            const not_found_err = new APIError(HttpStatusCode.NOT_FOUND, "repository")
            vi.spyOn(repository, "get_one_by_id").mockThrow(new APIError(HttpStatusCode.NOT_FOUND, "repository"))
            await expect(service.get_one_by_id(id)).rejects.toThrow(not_found_err)
        })
        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "get_one_by_id").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.get_one_by_id(id)).rejects.toThrow(bad_req_err)
        })
    })

    describe("Testing create_one()", async () => {
        const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
        const adeeb_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        const poem_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        let date = new Date() 
        let created_at = date
        let updated_at = date
        const chosen_verse = {
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id,
            poem_id: poem_id,
        }
        test("Success Test", async() => {
            vi.spyOn(repository, "create_one").mockResolvedValue({id, created_at, updated_at, ...chosen_verse})
            await expect(service.create_one(chosen_verse)).resolves.toEqual({id, created_at, updated_at, ...chosen_verse})
        })

        test("Fail Test: APIError=409", async() => {
            const conflict_err = new APIError(HttpStatusCode.CONFLICT, "repository")
            vi.spyOn(repository, "create_one").mockThrow(new APIError(HttpStatusCode.CONFLICT, "repository"))
            await expect(service.create_one(chosen_verse)).rejects.toThrow(conflict_err)
        })
        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "create_one").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.create_one(chosen_verse)).rejects.toThrow(bad_req_err)
        })
    })

    describe("Testing create_many()", async () => {
        const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
        const adeeb_id1 = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
        const adeeb_id2 = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
        const poem_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6"
        let date = new Date() 
        let created_at = date
        let updated_at = date
        const chosen_verse1 = {
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id1,
            poem_id: poem_id,
        }
        const chosen_verse2 = {
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id1,
            poem_id: poem_id,
        }
        const chosen_verse3 = {
            verses: [
                "verse1",
                "verse2",
                "verse3",
                "verse4",
            ],
            is_couplet: true,
            tags: ["tag1", "tag2"],
            reviewed: true,
            adeeb_id: adeeb_id2,
            poem_id: poem_id,
        }
        const success_inserts = [
            {id, created_at, updated_at, ...chosen_verse1},
            {id, created_at, updated_at, ...chosen_verse2},
        ]
        test("Success Test", async() => {
            vi.spyOn(repository, "create_many").mockResolvedValue(
                {
                    created_items: success_inserts, 
                    success_count: 2, 
                    invalid_items: [{item_index: 2, message: "Foreign Key Error"}]
                }
            )
            await expect(service.create_many([chosen_verse1, chosen_verse2])).resolves.toEqual({
                    created_items: success_inserts, 
                    success_count: 2, 
                    invalid_items: [{item_index: 2, message: "Foreign Key Error"}]
                }
            )
        })
        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "create_many").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.create_many([chosen_verse1, chosen_verse2, chosen_verse1])).rejects.toThrow(bad_req_err)
        })
    })

    describe("Testing update_one()", async () => {
        const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        let verses = [
            "verse1",
            "verse2",
            "verse3",
            "verse4",
        ]
        let is_couplet= true
        let adeeb_id =  id
        let poem_id =  id

        test("Success Test", async() => {
            vi.spyOn(repository, "update_one").mockResolvedValue(null)
            await expect(service.update_one(id, {verses, is_couplet})).resolves.toEqual(null)
            vi.spyOn(repository, "update_one").mockResolvedValue(null)
            await expect(service.update_one(id, {adeeb_id})).resolves.toEqual(null)
        })

        test("Fail Test: APIError=409", async() => {
            const conflict_err = new APIError(HttpStatusCode.CONFLICT, "repository")
            vi.spyOn(repository, "update_one").mockThrow(new APIError(HttpStatusCode.CONFLICT, "repository"))
            await expect(service.update_one(id, {name})).rejects.toThrow(conflict_err)
        })
        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "update_one").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.update_one(id, {name})).rejects.toThrow(bad_req_err)
        })
    })

    describe("Testing delete_one()", async () => {
        const id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
        test("Success Test", async() => {
            vi.spyOn(repository, "delete_one").mockResolvedValue(null)
            await expect(service.delete_one(id)).resolves.toEqual(null)
        })

        test("Fail Test: APIError=409", async() => {
            const conflict_err = new APIError(HttpStatusCode.CONFLICT, "repository")
            vi.spyOn(repository, "delete_one").mockThrow(new APIError(HttpStatusCode.CONFLICT, "repository"))
            await expect(service.delete_one(id)).rejects.toThrow(conflict_err)
        })
        test("Fail Test: APIError=400", async() => {
            const bad_req_err = new APIError(HttpStatusCode.BAD_REQUEST, "repository")
            vi.spyOn(repository, "delete_one").mockThrow(new APIError(HttpStatusCode.BAD_REQUEST, "repository"))
            await expect(service.delete_one(id)).rejects.toThrow(bad_req_err)
        })
    })
})