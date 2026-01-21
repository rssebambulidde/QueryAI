# Database Migrations

This directory contains SQL migration files for setting up the QueryAI database schema.

## Migration Files

1. **001_initial_schema.sql** - Creates all database tables and indexes
2. **002_row_level_security.sql** - Sets up Row Level Security (RLS) policies
3. **003_documents_text_extraction.sql** - Adds text extraction fields to documents table
4. **004_add_embedding_status.sql** - Adds embedding status tracking
5. **005_add_stored_status.sql** - Adds stored status for documents
6. **006_add_conversation_metadata.sql** - Adds metadata field to conversations for filter settings

## How to Run Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `001_initial_schema.sql`
4. Copy and paste the entire SQL into the editor
5. Click **Run** to execute
6. Repeat for `002_row_level_security.sql`

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: Using psql

```bash
# Connect to your Supabase database
psql -h your-project.supabase.co -U postgres -d postgres

# Run migrations
\i 001_initial_schema.sql
\i 002_row_level_security.sql
```

## Migration Order

**Important:** Run migrations in order:
1. First: `001_initial_schema.sql` (creates tables)
2. Then: `002_row_level_security.sql` (adds RLS policies)
3. Then: `003_documents_text_extraction.sql` (adds text extraction support)
4. Then: `004_add_embedding_status.sql` (adds embedding status)
5. Then: `005_add_stored_status.sql` (adds stored status)
6. Finally: `006_add_conversation_metadata.sql` (adds conversation metadata for filters)

## Verification

After running migrations, verify the setup:

1. Check tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. Test connection from backend:
   - Start your backend server
   - Visit `/health` endpoint
   - Check database health status

## Troubleshooting

### Error: "relation already exists"
- Tables already created - this is okay
- You can use `CREATE TABLE IF NOT EXISTS` (already included)

### Error: "permission denied"
- Ensure you're using the service role key in backend
- Check RLS policies are correctly set

### Error: "function does not exist"
- Ensure UUID extension is enabled
- Run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

## Schema Overview

### Tables Created

- **user_profiles** - Extended user information
- **topics** - User-defined topic scopes
- **conversations** - Conversation threads
- **messages** - Individual messages in conversations
- **subscriptions** - User subscription information
- **usage_logs** - Usage tracking for analytics

### Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Service role has full access for backend operations

## Next Steps

After running migrations:
1. Verify database connection in backend
2. Test RLS policies
3. Proceed to Phase 1.3: Authentication
