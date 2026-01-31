-- Add avatar_url column to user_profiles
-- Migration 028: Add avatar_url column for profile images

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN user_profiles.avatar_url IS 'URL to user profile avatar image stored in Supabase Storage';
