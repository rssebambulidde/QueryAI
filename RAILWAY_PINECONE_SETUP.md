# Railway Pinecone Setup Guide

## Issue
Vectors are not being stored in Pinecone because the `PINECONE_API_KEY` environment variable is not configured in Railway.

## Solution

### Step 1: Get Your Pinecone API Key

1. Go to [Pinecone Dashboard](https://app.pinecone.io/)
2. Sign in to your account
3. Navigate to **API Keys** section
4. Copy your **API Key** (it looks like: `12345678-1234-1234-1234-123456789012`)

### Step 2: Add Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your **QueryAI backend development** service
3. Go to the **Variables** tab
4. Click **+ New Variable**
5. Add the following variables:

#### Required Variables:

**PINECONE_API_KEY**
- **Name:** `PINECONE_API_KEY`
- **Value:** Your Pinecone API key (paste the key you copied)
- **Click:** **Add**

**PINECONE_INDEX_NAME** (Optional, has default)
- **Name:** `PINECONE_INDEX_NAME`
- **Value:** `queryai-embeddings` (or your index name)
- **Click:** **Add**

### Step 3: Verify Your Pinecone Index

Make sure your Pinecone index exists and matches:

- **Index Name:** `queryai-embeddings` (or whatever you set in `PINECONE_INDEX_NAME`)
- **Dimensions:** `1536` (for OpenAI text-embedding-3-small)
- **Metric:** `cosine`

### Step 4: Redeploy

After adding the environment variables:

1. Railway will automatically redeploy your service
2. Wait for the deployment to complete
3. Check the logs - you should see:
   ```
   Pinecone client initialized successfully
   ```
   Instead of:
   ```
   Pinecone API key not configured
   ```

### Step 5: Test

1. Process a document again
2. Check the logs - you should see:
   ```
   Storing vectors in Pinecone
   Upserted batch 1
   Vectors stored in Pinecone successfully
   ```
3. Check your Pinecone dashboard - you should see records appearing

## Verification

After setup, you can verify Pinecone is working:

### Option 1: Check Logs
Look for these log messages:
- ✅ `Pinecone client initialized successfully`
- ✅ `Storing vectors in Pinecone`
- ✅ `Vectors stored in Pinecone successfully`

### Option 2: Use Debug Endpoint
```bash
GET /api/debug/pinecone-status
```

Should return:
```json
{
  "success": true,
  "message": "Pinecone is configured and connected",
  "data": {
    "configured": true,
    "indexName": "queryai-embeddings",
    "stats": {
      "totalVectors": 108
    }
  }
}
```

## Troubleshooting

### Still seeing "Pinecone not configured"?
1. Verify the variable name is exactly `PINECONE_API_KEY` (case-sensitive)
2. Make sure there are no extra spaces in the value
3. Redeploy the service after adding the variable
4. Check Railway logs for any errors

### Vectors still not appearing?
1. Check Pinecone dashboard - records may take a few seconds to appear
2. Verify index name matches exactly
3. Check server logs for any Pinecone errors
4. Use the debug endpoint to test connection

## Current Status

Based on your logs:
- ❌ `PINECONE_API_KEY` - **NOT SET** (needs to be added)
- ✅ Document processing - **Working** (108 chunks created)
- ✅ Embedding generation - **Working** (108 embeddings generated)
- ❌ Vector storage - **Skipped** (because Pinecone not configured)

Once you add `PINECONE_API_KEY`, vectors will be stored automatically on the next document processing.
