-- Remove API Keys and Embedding Configs Tables
-- Migration 027: Drop api_keys, embedding_configs, and api_key_usage tables
-- This migration removes the API Keys and Embeddable Chatbot features

-- Step 1: Drop RLS Policies (from migration 008)
DROP POLICY IF EXISTS "Users can view own api_keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create own api_keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys" ON api_keys;
DROP POLICY IF EXISTS "Service role full access to api_keys" ON api_keys;

DROP POLICY IF EXISTS "Users can view own embedding_configs" ON embedding_configs;
DROP POLICY IF EXISTS "Users can create own embedding_configs" ON embedding_configs;
DROP POLICY IF EXISTS "Users can update own embedding_configs" ON embedding_configs;
DROP POLICY IF EXISTS "Users can delete own embedding_configs" ON embedding_configs;
DROP POLICY IF EXISTS "Service role full access to embedding_configs" ON embedding_configs;

DROP POLICY IF EXISTS "Users can view own api_key_usage" ON api_key_usage;
DROP POLICY IF EXISTS "Service role full access to api_key_usage" ON api_key_usage;

-- Step 2: Drop Triggers
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
DROP TRIGGER IF EXISTS update_embedding_configs_updated_at ON embedding_configs;

-- Step 3: Drop Indexes
DROP INDEX IF EXISTS idx_api_keys_user_id;
DROP INDEX IF EXISTS idx_api_keys_topic_id;
DROP INDEX IF EXISTS idx_api_keys_key_hash;
DROP INDEX IF EXISTS idx_api_keys_is_active;
DROP INDEX IF EXISTS idx_embedding_configs_user_id;
DROP INDEX IF EXISTS idx_embedding_configs_topic_id;
DROP INDEX IF EXISTS idx_api_key_usage_api_key_id;
DROP INDEX IF EXISTS idx_api_key_usage_created_at;

-- Step 4: Drop Tables (in order of dependencies)
-- api_key_usage references api_keys, so drop it first
DROP TABLE IF EXISTS api_key_usage CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS embedding_configs CASCADE;
