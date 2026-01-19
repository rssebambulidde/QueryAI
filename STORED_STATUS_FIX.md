# Fix: Stored Status for Uploaded Documents

## Issue
After uploading a document, it shows "Processing..." status instead of "Stored" with a Process button.

## Root Cause
The database doesn't have the 'stored' status in the CHECK constraint yet. The migration needs to be run.

## Solution

### Step 1: Run Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Migration: Add 'stored' status to documents table
-- This allows documents to be uploaded without auto-processing

-- Update status constraint to include 'stored'
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents
ADD CONSTRAINT documents_status_check
CHECK (status IN ('stored', 'processing', 'extracted', 'failed', 'embedding', 'embedded', 'embedding_failed', 'processed'));

-- Update default status to 'stored' for new documents
ALTER TABLE documents
ALTER COLUMN status SET DEFAULT 'stored';

-- Update any existing documents with 'processing' status that don't have extracted_text to 'stored'
UPDATE documents
SET status = 'stored'
WHERE status = 'processing' 
  AND (extracted_text IS NULL OR extracted_text = '');
```

### Step 2: Restart Backend

After running the migration, restart your backend server to pick up the changes.

### Step 3: Test

1. Upload a new document
2. It should show "Stored" status (gray badge with file icon)
3. Process button should be visible
4. View/Download buttons should be disabled until processed

## What Changed

1. **Database Schema**: Added 'stored' as a valid status
2. **Default Status**: New documents default to 'stored' instead of 'processing'
3. **Upload Flow**: Documents uploaded without auto-processing get 'stored' status
4. **UI**: Process button shows for 'stored' documents
5. **View/Download**: Disabled for 'stored' and 'processing' documents

## Migration File

The migration script is located at:
`backend/src/database/migrations/005_add_stored_status.sql`
