# Database Migration Guide - Phase 2.4

## 📋 Overview

This guide explains how to apply the database changes for Phase 2.4 (Embedding Generation) to your Supabase PostgreSQL database.

---

## 🔍 What Needs to Be Done

You need to run **2 SQL migrations** in your Supabase SQL Editor:

1. **003_documents_text_extraction.sql** (if not already run)
   - Creates `documents` and `document_chunks` tables
   - Adds RLS policies
   - Adds storage tracking

2. **004_add_embedding_status.sql** (NEW - for Phase 2.4)
   - Adds `embedding_error` column
   - Updates status constraint for embedding states
   - Adds performance indexes

---

## 📝 Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard: [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Check if Migration 003 Already Exists

**Check if `documents` table exists:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'documents'
);
```

**If it returns `true`**: Migration 003 is already applied ✅  
**If it returns `false`**: You need to run Migration 003 first

---

### Step 3: Run Migration 003 (if needed)

**Only run this if the `documents` table doesn't exist:**

1. Open the file: `backend/src/database/migrations/003_documents_text_extraction.sql`
2. Copy the entire SQL content
3. Paste it into Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**What it does:**
- Creates `documents` table
- Creates `document_chunks` table
- Adds RLS policies
- Adds indexes
- Adds storage tracking

---

### Step 4: Run Migration 004 (Required for Phase 2.4)

**This is required for embedding generation to work:**

1. Open the file: `backend/src/database/migrations/004_add_embedding_status.sql`
2. Copy the entire SQL content
3. Paste it into Supabase SQL Editor
4. Click **Run**

**What it does:**
- Adds `embedding_error` column to `documents` table
- Updates status constraint to include: `embedding`, `embedded`, `embedding_failed`
- Adds performance indexes

---

## ✅ Verification

After running the migrations, verify they worked:

### Check 1: Documents Table Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
```

**Should include:**
- `embedding_error` (TEXT, nullable)
- `status` (with new constraint values)

### Check 2: Status Constraint
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'documents_status_check';
```

**Should include:** `'embedding'`, `'embedded'`, `'embedding_failed'` in the check clause

### Check 3: Document Chunks Table
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_chunks'
ORDER BY ordinal_position;
```

**Should include:**
- `id`, `document_id`, `chunk_index`, `content`
- `start_char`, `end_char`, `token_count`
- `embedding_id`, `created_at`

### Check 4: Indexes
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('documents', 'document_chunks')
ORDER BY tablename, indexname;
```

**Should include:**
- `idx_documents_embedding_status`
- `idx_chunks_embedding_id`

---

## 🚨 Troubleshooting

### Error: "relation already exists"

**If you see:** `ERROR: relation "documents" already exists`

**Solution:** This means Migration 003 was already run. Skip it and only run Migration 004.

---

### Error: "constraint already exists"

**If you see:** `ERROR: constraint "documents_status_check" already exists`

**Solution:** The constraint might have a different name. Check existing constraints:

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%status%';
```

Then manually update the constraint:

```sql
-- Drop old constraint
ALTER TABLE documents DROP CONSTRAINT documents_status_check;

-- Add new constraint
ALTER TABLE documents 
ADD CONSTRAINT documents_status_check 
CHECK (status IN ('processing', 'extracted', 'failed', 'embedding', 'embedded', 'embedding_failed'));
```

---

### Error: "column already exists"

**If you see:** `ERROR: column "embedding_error" already exists`

**Solution:** The column already exists. Skip that part of the migration. You can verify:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name = 'embedding_error';
```

---

### Error: "permission denied"

**If you see:** `ERROR: permission denied`

**Solution:** 
1. Make sure you're using the **SQL Editor** (not the Table Editor)
2. Make sure you're logged in as the project owner
3. Try using the **Service Role** key if needed (for admin operations)

---

## 📋 Quick Migration Checklist

- [ ] Opened Supabase SQL Editor
- [ ] Checked if `documents` table exists
- [ ] Ran Migration 003 (if needed)
- [ ] Ran Migration 004 (required)
- [ ] Verified `embedding_error` column exists
- [ ] Verified status constraint includes embedding states
- [ ] Verified indexes are created
- [ ] Tested with a document upload

---

## 🔄 Alternative: Run Migrations Programmatically

If you prefer to run migrations programmatically, you can create a migration runner script:

```typescript
// backend/src/scripts/run-migrations.ts
import { supabaseAdmin } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration(filename: string) {
  const migrationPath = path.join(__dirname, '../database/migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
  
  if (error) {
    console.error(`Migration ${filename} failed:`, error);
    throw error;
  }
  
  console.log(`Migration ${filename} completed successfully`);
}

// Run migrations
async function main() {
  try {
    await runMigration('003_documents_text_extraction.sql');
    await runMigration('004_add_embedding_status.sql');
    console.log('All migrations completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
```

**Note:** This requires setting up a custom SQL function in Supabase. The SQL Editor method is simpler and recommended.

---

## 📚 Migration Files Location

All migration files are located in:
```
backend/src/database/migrations/
```

**Files:**
- `003_documents_text_extraction.sql` - Phase 2.3 (Text Extraction)
- `004_add_embedding_status.sql` - Phase 2.4 (Embedding Generation)

---

## ✅ After Migration

Once migrations are complete:

1. **Restart your backend** (if running)
2. **Test document upload** - embeddings should generate automatically
3. **Check logs** - verify embedding generation works
4. **Monitor database** - check `document_chunks` table fills up

---

## 🆘 Need Help?

If you encounter issues:

1. Check Supabase logs in the dashboard
2. Verify your database connection
3. Ensure you have proper permissions
4. Check the migration SQL for syntax errors
5. Review the verification queries above

---

**Ready to proceed?** Follow the steps above to apply the database changes! 🚀
