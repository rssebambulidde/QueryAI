-- Add user roles for admin/super_admin access control
-- Run this in Supabase SQL Editor

-- Add role column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Backfill existing users with 'user' role (if column was just added)
UPDATE user_profiles SET role = 'user' WHERE role IS NULL;

-- Update RLS policies to allow admins/super_admins to view all profiles (for admin features)
-- Note: This is optional - you may want to keep strict RLS and use service role for admin operations
-- Uncomment if you want admins to see all user profiles:
-- DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
-- CREATE POLICY "Admins can view all profiles"
--     ON user_profiles FOR SELECT
--     USING (
--         auth.uid() IN (
--             SELECT id FROM user_profiles WHERE role IN ('admin', 'super_admin')
--         )
--     );

-- Add comment
COMMENT ON COLUMN user_profiles.role IS 'User role: user (default), admin (can access admin features), super_admin (app owner, full access)';
