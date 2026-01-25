# Database Setup Guide

This guide explains how to set up the Supabase database for QueryAI.

## Overview

QueryAI uses **Supabase** (PostgreSQL) as its primary database. The database stores:
- User profiles
- Topics
- Conversations and messages
- Subscriptions
- Usage logs

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project
3. **API Keys**: Get your Supabase URL and keys (see [ENV_VARIABLES_GUIDE.md](../ENV_VARIABLES_GUIDE.md))

## Setup Steps

### Step 1: Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Run Database Migrations

1. Go to Supabase Dashboard → **SQL Editor**
2. Open `migrations/001_initial_schema.sql`
3. Copy and paste the entire SQL
4. Click **Run** to execute
5. Repeat for `migrations/002_row_level_security.sql`

**Migration Order:**
1. First: `001_initial_schema.sql` (creates tables)
2. Then: `002_row_level_security.sql` (adds RLS policies)

### Step 3: Verify Setup

1. Check tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

2. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. Test from backend:
   - Start your backend server
   - Visit `/health` endpoint
   - Check database health status

## Database Schema

### Tables

- **user_profiles** - Extended user information
- **topics** - User-defined topic scopes
- **conversations** - Conversation threads
- **messages** - Individual messages in conversations
- **subscriptions** - User subscription information
- **usage_logs** - Usage tracking for analytics

### Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Service role has full access for backend operations

## Using the Database Service

The database service (`services/database.service.ts`) provides helper methods:

```typescript
import { DatabaseService } from './services/database.service';

// Create user profile
const profile = await DatabaseService.createUserProfile(userId, email, fullName);

// Get user profile
const profile = await DatabaseService.getUserProfile(userId);

// Get user subscription
const subscription = await DatabaseService.getUserSubscription(userId);

// Log usage
await DatabaseService.logUsage(userId, 'query', { metadata });

// Get usage count
const count = await DatabaseService.getUserUsageCount(userId, 'query');
```

## Direct Supabase Client Usage

For more complex queries, use the Supabase client directly:

```typescript
import { supabaseAdmin } from './config/database';

// Query example
const { data, error } = await supabaseAdmin
  .from('conversations')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

## Troubleshooting

### Error: "relation does not exist"
- Run migrations first (Step 2)
- Check table names match exactly

### Error: "permission denied"
- Ensure RLS policies are set (run `002_row_level_security.sql`)
- Check you're using service_role key for admin operations

### Error: "connection refused"
- Verify `SUPABASE_URL` is correct
- Check network connectivity
- Verify Supabase project is active

### Error: "invalid API key"
- Verify `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check for extra spaces or newlines
- Regenerate keys in Supabase dashboard if needed

## Next Steps

After database setup:
1. ✅ Verify database connection in `/health` endpoint
2. ✅ Test database service methods
3. ✅ Proceed to Phase 1.3: Authentication

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
