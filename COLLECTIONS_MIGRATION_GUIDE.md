# Collections Feature - Database Migration Guide

## Overview

The Collections feature requires two database migrations to be run in your Supabase database:
1. `009_collections.sql` - Creates the collections tables
2. `010_collections_rls.sql` - Sets up Row Level Security policies

## Migration Steps

### Step 1: Run Collections Table Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `backend/src/database/migrations/009_collections.sql`
4. Copy and paste the entire SQL into the editor
5. Click **Run** to execute

This will create:
- `collections` table
- `collection_conversations` junction table
- Indexes for performance
- Updated_at trigger

### Step 2: Run Collections RLS Migration

1. In the same SQL Editor
2. Open `backend/src/database/migrations/010_collections_rls.sql`
3. Copy and paste the entire SQL into the editor
4. Click **Run** to execute

This will:
- Enable RLS on both tables
- Create policies for users to manage their own collections
- Allow service role full access

## Verification

After running migrations, verify the setup:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('collections', 'collection_conversations');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('collections', 'collection_conversations');

-- Test insert (should work with service role)
SELECT * FROM collections LIMIT 1;
```

## Migration Order

If you haven't run previous migrations, run them in this order:

1. `001_initial_schema.sql`
2. `002_row_level_security.sql`
3. `003_documents_text_extraction.sql`
4. `004_add_embedding_status.sql`
5. `005_add_stored_status.sql`
6. `006_add_conversation_metadata.sql`
7. `007_api_keys_and_embeddings.sql`
8. `008_api_keys_rls.sql`
9. **`009_collections.sql`** ← Collections tables
10. **`010_collections_rls.sql`** ← Collections RLS policies

## Troubleshooting

### Error: "relation 'collections' does not exist"
- **Solution**: Run `009_collections.sql` migration

### Error: "permission denied"
- **Solution**: Run `010_collections_rls.sql` migration
- Ensure you're using the service role key in backend environment variables

### Error: "duplicate key value violates unique constraint"
- This means a collection with that name already exists for your user
- Try a different name or delete the existing collection

### Error: "function uuid_generate_v4() does not exist"
- Run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- This is usually already in `001_initial_schema.sql`

## After Migration

Once migrations are complete:
1. Restart your backend server (if running)
2. Try creating a collection again
3. The feature should work correctly

## Quick Migration Script

You can also run both migrations at once:

```sql
-- Run 009_collections.sql content here
-- Then run 010_collections_rls.sql content here
```

Both files are in: `backend/src/database/migrations/`
