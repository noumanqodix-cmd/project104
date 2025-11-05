-- Create session tokens table for JWT token management
CREATE TABLE "session_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" text NOT NULL,
  "is_token_expired" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "user_id" varchar NOT NULL,
  "email" varchar NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX "IDX_session_tokens_user_id" ON "session_tokens"("user_id");
CREATE INDEX "IDX_session_tokens_email" ON "session_tokens"("email");
CREATE INDEX "IDX_session_tokens_expires_at" ON "session_tokens"("expires_at");
CREATE INDEX "IDX_session_tokens_is_token_expired" ON "session_tokens"("is_token_expired");

-- Add check constraint for is_token_expired (0 or 1)
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_is_token_expired_check"
CHECK ("is_token_expired" IN (0, 1));