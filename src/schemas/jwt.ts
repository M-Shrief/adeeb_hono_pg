import {
  pipe,
  optional,
  array,
  object,
  string,
  trim,
  maxLength,
  minLength,
  number,
  fallback,
  boolean,
  date,
  enum as enum_schema
} from 'valibot';
/////
import { TokenType, TokenTypeEnum, RoleEnumType } from '../database/schemas.js';
import { uuid_schema } from './general.js';

export const is_banned_schema = fallback(boolean(), false);
export const used_schema = fallback(boolean(), false);
export const exp_schema = date()
export const iat_schema = date()
export const token_type_schema = enum_schema(TokenTypeEnum);


export const one_schema = object({
  jti: uuid_schema,
  family_id: uuid_schema,
  user_id: uuid_schema,
  used: used_schema,
  token_type: token_type_schema,
  is_banned: is_banned_schema,
  exp: exp_schema,
  iat: iat_schema
})

export type Claims = {
  jti: string,
  family_id: string,
  user?: {
    id: string,
    username: string,
    roles: RoleEnumType[]
  },
  token_type: TokenType,
  permissions?: string[],
  exp: number,
  iat: number,
} 

// let user: Claims["user"]