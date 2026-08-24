# adeeb_hono
Adeeb's Backend iteration in JS & TS, using Hono

All iterations should apply the same characteristics, like:
- JWT authentication & authorization
- API documentation (mostly with Scalar)
- Input/Output Validation
- ...etc

## Tech stack
- Framework: hono
- Database: Postgres & DrizzleORM
- Cache: ValKey
- Testing: Vitest
- Validation: valibot
- Logger: Pino

## Changes
- Used DrizzleORM instead of TypeORM
- Added Scalar documentation, using OpenAPI 3.0 with support from `hono-openapi`
- Used Pino logger instead of winston.

## Notes
- We don't use [DrizzleORM integration with valibot](https://orm.drizzle.team/docs/valibot), so that they're decoupled, so we can change one of them if we want.