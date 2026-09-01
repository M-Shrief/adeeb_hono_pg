import {
  pipe,
  optional,
  object,
  string,
  trim,
  maxLength,
  minLength,
} from 'valibot';
/////////////
// utils
import { uuid_schema, qoute_schema, tags_schema, reviewed_schema } from './general.js';


/** source is always used with optional()
*/ 
export const source_schema = pipe(string(), trim(), minLength(4), maxLength(128));


export const one_schema = object({
  id: uuid_schema,
  qoute: qoute_schema,
  source: optional(source_schema),
  tags: tags_schema,
  reviewed: reviewed_schema,

  adeeb_id: uuid_schema,
})

export const minimal_schema = object({
  id: uuid_schema,
  qoute: qoute_schema,
})

