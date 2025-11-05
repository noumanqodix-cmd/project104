-- Add unique constraint to session_tokens table
-- Ensures each user can have only one active session token
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_user_id_unique" UNIQUE ("user_id");