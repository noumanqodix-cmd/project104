CREATE TABLE "email_otp" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"otp" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_otp_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "session_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"is_token_expired" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "IDX_email_otp_expires_at" ON "email_otp" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_session_tokens_user_id" ON "session_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_tokens_email" ON "session_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "IDX_session_tokens_expires_at" ON "session_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_session_tokens_is_token_expired" ON "session_tokens" USING btree ("is_token_expired");