-- Add verification status column to users table
ALTER TABLE "users" ADD COLUMN "verification_status" text DEFAULT 'pending';

-- Add check constraint to ensure only valid values
ALTER TABLE "users" ADD CONSTRAINT "users_verification_status_check" 
CHECK ("verification_status" IN ('pending', 'verified', 'restricted'));