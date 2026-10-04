import { describe, expect, it, vi, test, beforeAll } from 'vitest';
///////
import { safeParse } from 'valibot';
import {create_many_req, create_one_req, get_one_res, update_req} from './schema.js'
import { is_couplet } from '../../database/columns.js';


describe.concurrent("Testing ChosenVerses' schema", async () => {
    const id = '0343952d-58fc-4f56-b2b6-fc04731de5ce';
    const adeeb_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
    const poem_id = "e7749f21-9cf9-4981-b7a8-2ce262f159f6";
    let create_one_chosen_verse_req = {
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
    const adeeb = {
        id: adeeb_id,
        name: 'عنترة بن شداد',
    }
    const poem = {
        id: poem_id,
        intro: 'حَكِّم سُيوفَكَ في رِقابِ العُذَّلِ',
    }
    describe("Testing get_one_res schema", async () => {
        test("Testing success", async() => {
            let one_response = {
                id,
                ...create_one_chosen_verse_req,
                adeeb,
                poem,
            }
            const res = safeParse(get_one_res, one_response);
            expect(res.success).toEqual(true);
            expect(res.output).toEqual(one_response);  
        })
        test("Testing faliure", async() => {
            let one_response1 = {
                id,
                ...create_one_chosen_verse_req,
                adeeb,
            }
            const res1 = safeParse(get_one_res, one_response1);
            expect(res1.success).toEqual(false);
            let one_response2 = {
                id,
                ...create_one_chosen_verse_req,
                poem,
            }
            const res2 = safeParse(get_one_res, one_response2);
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing create_one_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(create_one_req, create_one_chosen_verse_req);
            expect(res.success).toEqual(true);
            expect(res.output).toEqual(create_one_chosen_verse_req);  
        })
        test("Testing failure", async() => {
            const res1 = safeParse(create_one_req, {
                verses: [
                    "verse1",
                    "verse2",
                    "verse3",
                    "verse4",
                ],
                is_couplet: true,
                tags: ["tag1", "tag2"],
                reviewed: true,
            });
            expect(res1.success).toEqual(false);
            const res2 = safeParse(create_one_req, {
                tags: ["tag1", "tag2"],
                reviewed: true,
                adeeb_id: adeeb_id,
                poem_id: poem_id
            });
            expect(res2.success).toEqual(false);
            const res3 = safeParse(create_one_req, {
                verses: "asggsagsa",
                tags: ["tag1", "tag2"],
                reviewed: true,
                adeeb_id: adeeb_id,
                poem_id: poem_id
            });
            expect(res3.success).toEqual(false);
        })
    })
    describe("Testing create_many_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(create_many_req, [create_one_chosen_verse_req,create_one_chosen_verse_req]);
            expect(res.success).toEqual(true);
            expect(res.output).toEqual([create_one_chosen_verse_req,create_one_chosen_verse_req]);  
        })        
        test("Testing failure", async() => {
            const res1 = safeParse(create_many_req, [
                {
                    verses: "asggsagsa",
                    tags: ["tag1", "tag2"],
                    reviewed: true,
                    adeeb_id: adeeb_id,
                    poem_id: poem_id
                },
                                {
                    verses: "asggsagsa",
                    tags: ["tag1", "tag2"],
                    reviewed: true,
                    adeeb_id: adeeb_id,
                    poem_id: poem_id
                }
            ]);
            expect(res1.success).toEqual(false);
            const res2 = safeParse(create_many_req, [
                {
                    verses: [
                        "verse1",
                        "verse2",
                        "verse3",
                        "verse4",
                    ],
                    is_couplet: true,
                    tags: ["tag1", "tag2"],
                    reviewed: true,
                },
                {
                    verses: [
                        "verse1",
                        "verse2",
                        "verse3",
                        "verse4",
                    ],
                    is_couplet: true,
                    tags: ["tag1", "tag2"],
                    reviewed: true,
                }
            ]);
            expect(res2.success).toEqual(false);
        })
    })
    describe("Testing update_req schema", async () => {
        test("Testing success", async() => {
            const res1 = safeParse(update_req, {
                adeeb_id: adeeb_id,
                poem_id: poem_id
            });
            expect(res1.success).toEqual(true);
            const res2 = safeParse(update_req, {
                verses: [
                    "verse1",
                    "verse2",
                    "verse3",
                    "verse4",
                ],
                is_couplet: true,
            });
            expect(res2.success).toEqual(true);
            const res3 = safeParse(update_req, {
                tags: ["tag1", "tag2"],
            });
            expect(res3.success).toEqual(true);
        })
        test("Testing failure", async() => {
            const res1 = safeParse(update_req, {
                verses: 125,
            });
            expect(res1.success).toEqual(false);
            const res2 = safeParse(update_req, {
                tags: "Jagsgsa",
                is_couplet: "safasf"
            });
            expect(res2.success).toEqual(false);
            const res3 = safeParse(update_req, {
                poem_id: 125,
            });
            expect(res3.success).toEqual(false);

        })
    })
})