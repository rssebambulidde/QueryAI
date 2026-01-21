# Document Search Troubleshooting Guide

**Issue:** Document search is not retrieving results when "Documents" toggle is enabled.

---

## 🔍 Diagnostic Steps

### Step 1: Check Pinecone Configuration

**Check if Pinecone API key is set:**

1. Go to your Railway dashboard
2. Navigate to your backend service → Variables
3. Verify `PINECONE_API_KEY` is set
4. Verify `PINECONE_INDEX_NAME` is set (default: `queryai-embeddings`)

**If not set:**
- Get your Pinecone API key from [Pinecone Console](https://app.pinecone.io/)
- Add it to Railway environment variables
- Redeploy the backend

---

### Step 2: Verify Documents Are Processed

**Check document status:**

1. Go to the Documents tab in your app
2. Look for documents with status:
   - ✅ `processed` - Ready for search
   - ✅ `embedded` - Ready for search
   - ❌ `stored` - Not processed yet
   - ❌ `processing` - Still processing
   - ❌ `failed` - Processing failed

**If documents are not processed:**
1. Click the "Process" button on each document
2. Wait for status to change to `processed` or `embedded`
3. Check that `chunkCount` is greater than 0

---

### Step 3: Verify Documents Are in Pinecone

**Check backend logs for Pinecone upsert:**

When you process a document, you should see logs like:
```
Chunks created successfully
Document vectors upserted to Pinecone
```

**If you see:**
```
Pinecone not configured, skipping vector storage
```
→ Pinecone is not configured (see Step 1)

**If you see:**
```
Pinecone API key not configured
```
→ Add PINECONE_API_KEY to Railway

---

### Step 4: Check Search Logs

**When asking a question with Documents enabled, check logs for:**

1. **Query embedding generation:**
   ```
   Generating query embedding for document retrieval
   ```

2. **Pinecone search:**
   ```
   Searching Pinecone for document chunks
   Semantic search completed
   ```

3. **Results:**
   ```
   Found document chunks in Pinecone
   chunkCount: X
   ```

**If you see:**
```
No relevant document chunks found in Pinecone
```
→ Possible causes:
- Documents not embedded (see Step 2)
- Similarity threshold too high (try lowering minScore)
- Query doesn't match document content

**If you see:**
```
Pinecone is not configured - document search unavailable
```
→ Configure Pinecone (see Step 1)

---

### Step 5: Test with Lower Similarity Threshold

**The default similarity threshold is 0.5.** If no results are found, the system automatically tries with 0.3.

**To manually adjust:**

1. The frontend default is `minScore: 0.5`
2. You can lower it in the code if needed (in `chat-interface.tsx`)
3. Lower values (0.3-0.4) will find more documents but may be less relevant

---

## 🐛 Common Issues & Solutions

### Issue 1: "No relevant document chunks found"

**Possible causes:**
1. Documents not processed/embedded
2. Pinecone not configured
3. Similarity threshold too high
4. Query doesn't match document content

**Solutions:**
- ✅ Process documents (click "Process" button)
- ✅ Verify Pinecone is configured
- ✅ Try different query wording
- ✅ Check that documents actually contain the information you're asking about

---

### Issue 2: "Pinecone is not configured"

**Solution:**
1. Get Pinecone API key from [Pinecone Console](https://app.pinecone.io/)
2. Create an index named `queryai-embeddings` (or set `PINECONE_INDEX_NAME`)
3. Set dimension to `1536` (for OpenAI embeddings)
4. Add `PINECONE_API_KEY` to Railway environment variables
5. Redeploy backend

---

### Issue 3: Documents processed but not searchable

**Check:**
1. Are chunks created? (check `chunkCount` in UI)
2. Are vectors upserted? (check logs for "upserted to Pinecone")
3. Is Pinecone index correct? (check `PINECONE_INDEX_NAME`)

**Solution:**
- If chunks exist but vectors don't: Check Pinecone configuration
- If vectors upserted but not found: Check userId filtering in search

---

### Issue 4: Web search works but documents don't

**This indicates:**
- ✅ Backend is working
- ✅ API calls are working
- ❌ Document search specifically is failing

**Check:**
1. Pinecone configuration (most likely)
2. Documents are processed and embedded
3. User ID is correct (documents are user-specific)

---

## 📊 Debugging Checklist

- [ ] Pinecone API key is set in Railway
- [ ] Pinecone index exists and is named correctly
- [ ] Documents have status `processed` or `embedded`
- [ ] Documents have `chunkCount > 0`
- [ ] Backend logs show "upserted to Pinecone" when processing
- [ ] Backend logs show "Searching Pinecone" when querying
- [ ] No "Pinecone not configured" errors in logs
- [ ] User ID is correct (documents are user-specific)

---

## 🔧 Quick Fixes

### Fix 1: Re-process Documents

If documents were processed before Pinecone was configured:

1. Go to Documents tab
2. Click "Clear" on each document
3. Click "Process" again
4. Wait for status to be `processed`
5. Try searching again

### Fix 2: Verify Pinecone Index

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Check that index `queryai-embeddings` exists
3. Check that it has vectors (should show vector count > 0)
4. Verify dimension is `1536`

### Fix 3: Check User Isolation

Documents are user-specific. Make sure:
- You're logged in as the same user who uploaded/processed the documents
- The userId in the search matches the userId who owns the documents

---

## 📝 Log Analysis

**Good logs (working):**
```
Generating query embedding for document retrieval
Searching Pinecone for document chunks
Semantic search completed: resultsCount: 3
Found document chunks in Pinecone: chunkCount: 3
Document context retrieved: chunkCount: 3
```

**Bad logs (not working):**
```
Pinecone is not configured - document search unavailable
```
→ Fix: Configure Pinecone

```
No relevant document chunks found in Pinecone
```
→ Fix: Process documents or lower threshold

```
Pinecone search called but Pinecone is not configured
```
→ Fix: Set PINECONE_API_KEY

---

## 🆘 Still Not Working?

If after checking all the above, document search still doesn't work:

1. **Check Railway logs** for detailed error messages
2. **Verify Pinecone index** has vectors in the console
3. **Test with a simple query** like "what is in the document"
4. **Check document content** - make sure it actually contains the information you're asking about
5. **Try processing a new document** to verify the full pipeline works

---

**Last Updated:** 2025-01-27
