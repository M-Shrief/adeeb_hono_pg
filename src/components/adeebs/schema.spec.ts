import { describe, expect, it, vi, test, beforeAll } from 'vitest';
///////
import { safeParse } from 'valibot';
import { TimePeriodEnum } from '../../database/schemas.js';
import {create_many_req, create_one_req} from './schema.js'
import { reviewed } from '../../database/columns.js';


describe.concurrent("Testing Adeebs' schema", async () => {
    const create_one_adeeb_req = {
        name: 'عنترة بن شداد',
        time_period: TimePeriodEnum.JAHLI,
        bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
        reviewed: true
    }
    describe("Testing create_one_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(create_one_req, create_one_adeeb_req);
            expect(res.success).toEqual(true);
            expect(res.output).toEqual(create_one_adeeb_req);  

        })
        test("Testing failure", async() => {
            const res1 = safeParse(create_one_req, {
                name: 125,
                time_period: TimePeriodEnum.JAHLI,
                bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
            });
            expect(res1.success).toEqual(false);
            const res2 = safeParse(create_one_req, {
                name: 'عنترة بن شداد',
                time_period: "JAHLI",
                bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
            });
            expect(res2.success).toEqual(false);
            const res3 = safeParse(create_one_req, {
                name: 'عنترة بن شداد',
                time_period: TimePeriodEnum.JAHLI,
                bio: [1,2]
            });
            expect(res3.success).toEqual(false);

        })
    })
    describe("Testing create_many_req schema", async () => {
        test("Testing success", async() => {
            const res = safeParse(create_many_req, [create_one_adeeb_req,create_one_adeeb_req]);
            expect(res.success).toEqual(true);
            expect(res.output).toEqual([create_one_adeeb_req,create_one_adeeb_req]);  
        })        
        test("Testing failure", async() => {
            const res1 = safeParse(create_many_req, [
                {
                    name: 125,
                    time_period: TimePeriodEnum.JAHLI,
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                },
                {
                    name: 125,
                    time_period: TimePeriodEnum.JAHLI,
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                },
                {
                    name: 125,
                    time_period: TimePeriodEnum.JAHLI,
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                }
            ]);
            expect(res1.success).toEqual(false);
            const res2 = safeParse(create_many_req, [
                {
                    name: 'عنترة بن شداد',
                    time_period: "AHLI",
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                },
                {
                    name: 'عنترة بن شداد',
                    time_period: "AHLI",
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                },
                {
                    name: 'عنترة بن شداد',
                   time_period: "AHLI",
                    bio: 'عنترة بن عمرو بن شداد بن معاوية بن قراد العبسي (525 م - 608 م) هو أحد أشهر شعراء العرب في فترة ما قبل الإسلام، اشتهر بشعر الفروسية، وله معلقة مشهورة. وهو أشهر فرسان العرب وأشعرهم وشاعر المعلقات والمعروف بشعره الجميل وغزله العفيف بعبلة.',
                }
            ]);
            expect(res2.success).toEqual(false);
            const res3 = safeParse(create_many_req, [
                {
                    name: 'عنترة بن شداد',
                    time_period: "AHLI",
                    bio: [1,2]
                },
                {
                    name: 'عنترة بن شداد',
                    time_period: "AHLI",
                    bio: [1,2]
                },
                {
                    name: 'عنترة بن شداد',
                    time_period: "AHLI",
                    bio: [1,2]
                }
            ]);
            expect(res3.success).toEqual(false);

        })
    })

})