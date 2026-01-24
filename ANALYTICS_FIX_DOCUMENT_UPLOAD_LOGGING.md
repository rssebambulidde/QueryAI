# Analytics Fix: Document Upload Logging

## 🔴 Problem Identified

The analytics dashboard was showing **0** for all document upload statistics, even though users have uploaded documents. This is because **document uploads were not being logged** to the `usage_logs` table.

## ✅ Root Cause

In `backend/src/routes/documents.routes.ts`, when documents are uploaded via the `/api/documents/upload` endpoint, there was **no call to `DatabaseService.logUsage`** to track the upload event.

The analytics service (`backend/src/services/analytics.service.ts`) correctly queries the `usage_logs` table for `document_upload` events, but since these events were never being created, all statistics showed 0.

## 🛠️ Fix Applied

Added usage logging to the document upload route:

```typescript
// Log document upload for analytics
try {
  const { DatabaseService } = await import('../services/database.service');
  await DatabaseService.logUsage(userId, 'document_upload', {
    documentId: document.id,
    filename: storedDoc.name,
    fileType: fileType,
    fileSize: storedDoc.size,
    topicId: topicId,
  });
} catch (usageError: any) {
  logger.warn('Failed to log document upload usage', { error: usageError?.message });
}
```

**Location:** `backend/src/routes/documents.routes.ts` (after document creation)

## 📊 What This Fixes

### Before Fix:
- ✅ Document uploads worked correctly
- ❌ Document uploads were **not logged** to `usage_logs`
- ❌ Analytics showed **0** for all document upload metrics:
  - Total Uploads: 0
  - This Month: 0
  - Last Month: 0

### After Fix:
- ✅ Document uploads work correctly
- ✅ Document uploads are **now logged** to `usage_logs`
- ✅ Analytics will show correct statistics for **new uploads**

## ⚠️ Important Notes

### Historical Data

**Documents uploaded before this fix will NOT appear in analytics** because they weren't logged. Only documents uploaded **after this fix is deployed** will be tracked.

### To See Statistics Immediately

1. **Upload a new document** after deploying this fix
2. The analytics dashboard will show:
   - Total Uploads: 1 (or more if you upload multiple)
   - This Month: 1 (if uploaded this month)
   - Last Month: 0 (unless uploaded last month)

### Backfilling Historical Data (Optional)

If you want to backfill historical document uploads, you could:

1. Query all documents from the `documents` table
2. For each document, create a `usage_logs` entry with:
   - `type`: `'document_upload'`
   - `user_id`: Document's user_id
   - `created_at`: Document's `created_at` timestamp
   - `metadata`: Document metadata

**Example SQL (run in Supabase SQL Editor):**

```sql
-- Backfill document upload logs from existing documents
INSERT INTO usage_logs (user_id, type, metadata, created_at)
SELECT 
  user_id,
  'document_upload'::text,
  jsonb_build_object(
    'documentId', id,
    'filename', filename,
    'fileType', file_type,
    'fileSize', file_size
  ),
  created_at
FROM documents
WHERE NOT EXISTS (
  SELECT 1 
  FROM usage_logs 
  WHERE usage_logs.user_id = documents.user_id 
    AND usage_logs.type = 'document_upload'
    AND (usage_logs.metadata->>'documentId')::uuid = documents.id
);
```

**⚠️ Warning:** Only run this if you want to backfill historical data. It will create usage logs for all existing documents.

## 🧪 Testing

After deploying this fix:

1. **Upload a new document** via the frontend
2. **Check the analytics dashboard** - it should show:
   - Total Uploads: 1 (or increment if you upload more)
   - This Month: 1 (if uploaded this month)
3. **Verify in database** (optional):
   ```sql
   SELECT * FROM usage_logs 
   WHERE type = 'document_upload' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## 📋 Summary

- ✅ **Fixed:** Document uploads now log to `usage_logs` table
- ✅ **Result:** Analytics will show correct statistics for new uploads
- ⚠️ **Note:** Historical uploads (before fix) won't appear in analytics
- 🔄 **Next Step:** Deploy the fix and test with a new document upload

## 🔍 Related Files

- `backend/src/routes/documents.routes.ts` - Document upload route (fixed)
- `backend/src/services/analytics.service.ts` - Analytics service (already correct)
- `backend/src/services/database.service.ts` - Usage logging service (already correct)
- `frontend/components/analytics/analytics-dashboard.tsx` - Analytics UI (already correct)
