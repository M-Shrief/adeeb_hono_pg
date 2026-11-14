import { relations } from "drizzle-orm";
import { pgTable, pgEnum, varchar, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
///
import { adeeb_id, chosen_verses_id_optional, id, order_id, poem_id, poem_id_optional, prose_qoute_id_optional, qoute, qoute_optional, reviewed, tags, timestamps, user_id_optional, verses, verses_optional, is_couplet, is_couplet_optional } from "./columns.js"


// Didn't use enum for preformance, so we just use as const
export const TimePeriodEnum = {
    UNDEFINED : "غير محدد",
    JAHLI : "جاهلي",
    AMOEI : "أموي",
    ABASI : "عباسي",
    ANDALUSI : "أندلسي",
    TURKISH_ERA : "عثماني ومملوكي",
    MODERN : "حديث"
} as const

export const time_period_enum = pgEnum("time_period_enum", [TimePeriodEnum.UNDEFINED, TimePeriodEnum.JAHLI, TimePeriodEnum.AMOEI, TimePeriodEnum.ABASI, TimePeriodEnum.ANDALUSI, TimePeriodEnum.TURKISH_ERA, TimePeriodEnum.MODERN]);

export const adeeb_table = pgTable('adeebs', {
    ...id,
    name: varchar({ length: 128 }).unique().notNull(),
    bio: varchar({ length: 1024 }).notNull(),
    time_period: time_period_enum().default(TimePeriodEnum.UNDEFINED),
    ...reviewed,
    ...timestamps,
})


export const poem_table = pgTable('poems', {
    ...id,
    intro: varchar({ length: 256 }).unique().notNull(),
    ...verses,
    ...is_couplet,
    ...reviewed,
    ...timestamps,
    // relations
    ...adeeb_id,
})


export const chosen_verses_table = pgTable('chosen_verses', {
    ...id,
    ...tags, 
    ...verses,
    ...is_couplet,
    ...reviewed,
    ...timestamps,
    // relations
    ...adeeb_id,
    ...poem_id,
})

export const prose_qoutes_table = pgTable('prose_qoutes', {
    ...id,
    ...qoute,
    source: varchar({ length: 128 }),
    ...tags, 
    ...reviewed,
    ...timestamps,
    // relations
    ...adeeb_id,
})


export const RoleEnum = {
  NORMAL: "Normal",
  MANAGMENT: "Management",
  DBA: "DBA",
  ANALYTICS: "Analytics",
  BANNED: "Banned"
} as const

export type RoleEnumType = typeof RoleEnum[keyof typeof RoleEnum];

export const roles_enum = pgEnum("roles_enum", [RoleEnum.NORMAL, RoleEnum.MANAGMENT, RoleEnum.DBA, RoleEnum.ANALYTICS, RoleEnum.BANNED]);

export const user_table = pgTable('users', {
    ...id,
    username: varchar({ length: 128 }).unique().notNull(),
    password: varchar({ length: 256 }).notNull(),
    roles: roles_enum().array().default([RoleEnum.NORMAL]).notNull(),
    ...timestamps
})


export const TokenTypeEnum = {
    ACCESS: "access",
    REFRESH: "refresh"
} as const
export type TokenType = typeof TokenTypeEnum[keyof typeof TokenTypeEnum];

export const token_type_enum = pgEnum("token_type_enum", [TokenTypeEnum.ACCESS, TokenTypeEnum.REFRESH]);

export const jwt_table = pgTable('jwts', {
    jti: uuid().primaryKey().defaultRandom(),
    family_id: uuid().notNull(),
    used: boolean().default(false).notNull(),
    is_banned: boolean().default(false).notNull(),
    token_type: token_type_enum().default(TokenTypeEnum.ACCESS).notNull(),
    exp: timestamp().notNull(),
    iat: timestamp().notNull(),
    // relations
    user_id: uuid().notNull(),
})


export const OrderStatusEnum = {
    IN_PROGRESS: "in progress",
    ABORTED: "aborted",
    COMPLETED: "completed",
} as const


export const order_status_enum = pgEnum("order_status_enum", [OrderStatusEnum.IN_PROGRESS, OrderStatusEnum.COMPLETED, OrderStatusEnum.ABORTED]);


export const order_table = pgTable('orders', {
    ...id,
    ...user_id_optional,    
    name: varchar({ length: 128}).notNull(),
    phone: varchar({ length: 128}).notNull(),
    address: varchar({ length: 256}).notNull(),
    delivery_schedule: timestamp(),
    is_updateable: boolean().default(true).notNull(),
    status: order_status_enum().default(OrderStatusEnum.IN_PROGRESS).notNull(),
    ...reviewed,
    ...timestamps
})


// Prints /////////////////

export const OutfitTypeEnum = {
    TSHIRT_7: "تيشيرت - لياقة 7",
    TSHIRT_HALF: "تيشيرت - نص لياقة ",
    TSHIRT_POLO: "تشيرت - لياقة بولو",
    JACKET: "جاكيت",
    SWEETSHIRT: "سويت شيرت",
    PULLOVER: "بلوفر",
} as const


export const outfit_type_enum = pgEnum("outfit_type_enum", [OutfitTypeEnum.TSHIRT_7, OutfitTypeEnum.TSHIRT_HALF, OutfitTypeEnum.TSHIRT_POLO, OutfitTypeEnum.JACKET, OutfitTypeEnum.SWEETSHIRT, OutfitTypeEnum.PULLOVER]);

export const prints_table = pgTable('prints', {
    ...id,
    font_type: varchar({ length: 64 }).notNull(),
    font_color: varchar({ length: 64 }).notNull(),
    outfit_type: outfit_type_enum().notNull(),
    outfit_color: varchar({ length: 64 }).notNull(),    

    ...qoute_optional,
    ...verses_optional,
    ...is_couplet_optional,

    // relations
    ...order_id,
    ...user_id_optional,    

    ...poem_id_optional,
    ...chosen_verses_id_optional,
    ...prose_qoute_id_optional,
})


//////////////////////// Relations ////////////////////
 

export const adeeb_relations = relations(adeeb_table, ({ many }) => ({
    poems: many(poem_table),
    chosen_verses: many(chosen_verses_table),
    prose_qoutes: many(prose_qoutes_table),
}))

export const poem_relations = relations(poem_table, ({one, many}) => ({
	adeeb: one(adeeb_table, {
		fields: [poem_table.adeeb_id],
		references: [adeeb_table.id],
	}),
    chosen_verses: many(chosen_verses_table),
}));

export const chosen_verses_relations = relations(chosen_verses_table, ({ one }) => ({
	adeeb: one(adeeb_table, {
		fields: [chosen_verses_table.adeeb_id],
		references: [adeeb_table.id],
	}),
    poem: one(poem_table, {
        fields: [chosen_verses_table.poem_id],
        references: [poem_table.id]
    })
}));

export const prose_qoutes_relations = relations(prose_qoutes_table, ({ one }) => ({
	adeeb: one(adeeb_table, {
		fields: [prose_qoutes_table.adeeb_id],
		references: [adeeb_table.id],
	}),
}));

export const user_relations = relations(user_table, ({ many }) => ({
    orders: many(order_table),
    prints: many(prints_table),
}));


export const jwt_relations = relations(jwt_table, ({one, many}) => ({
	user: one(user_table, {
		fields: [jwt_table.user_id],
		references: [user_table.id],
	}),
}));

export const order_relations = relations(order_table, ({one, many}) => ({
	user: one(user_table, {
		fields: [order_table.user_id],
		references: [user_table.id],
	}),
    prints: many(prints_table),
}));

export const print_relations = relations(prints_table, ({one, many}) => ({
	order: one(order_table, {
		fields: [prints_table.order_id],
		references: [order_table.id],
	}),
    user: one(user_table, {
		fields: [prints_table.user_id],
		references: [user_table.id],
	}),
}));
