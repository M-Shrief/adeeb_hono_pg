CREATE TYPE "public"."token_type_enum" AS ENUM('access', 'refresh');--> statement-breakpoint
CREATE TABLE "jwts" (
	"jti" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"token_type" "token_type_enum" DEFAULT 'access' NOT NULL,
	"exp" timestamp NOT NULL,
	"iat" timestamp NOT NULL,
	"user_id" uuid NOT NULL
);
