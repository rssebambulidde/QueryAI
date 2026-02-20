-- Migration 046: Remove 'admin' role, keeping only 'user' and 'super_admin'
--
-- 1. Promote any existing 'admin' users to 'super_admin'
-- 2. Update the CHECK constraint to only allow 'user' and 'super_admin'

BEGIN;

-- Step 1: Promote existing admin users to super_admin
UPDATE user_profiles
SET role = 'super_admin'
WHERE role = 'admin';

-- Step 2: Drop the old constraint and add the new one
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('user', 'super_admin'));

COMMIT;
