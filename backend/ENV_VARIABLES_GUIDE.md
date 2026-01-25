# Environment Variables Location Guide

This guide helps you locate all required environment variable values for Railway deployment.

---

## 1. NODE_ENV

**Value:** `development` (for Railway development environment)

**Explanation:**
- This is manually set by you
- Use `development` for development/staging
- Use `production` for production environment

**How to set:**
```
NODE_ENV=development
```

---

## 2. SUPABASE_URL

**Where to find:**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Click on your project (or create a new one)
4. Go to **Settings** (gear icon in sidebar)
5. Click **API** in the settings menu
6. Under **Project URL**, copy the URL

**Example:**
```
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
```

---

## 3. SUPABASE_ANON_KEY

**Where to find:**
1. Same location as above: Supabase Dashboard → Settings → API
2. Under **Project API keys**
3. Copy the **anon/public** key (the one that starts with `eyJ...`)

**Example:**
```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMzQ1Njc4OSwiZXhwIjoxOTM5MDMyNzg5fQ...
```

**Note:** This key is safe to expose (it's used in client-side code)

---

## 4. SUPABASE_SERVICE_ROLE_KEY

**Where to find:**
1. Same location: Supabase Dashboard → Settings → API
2. Under **Project API keys**
3. Copy the **service_role** key (the one that starts with `eyJ...`)

**Example:**
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjIzNDU2Nzg5LCJleHAiOjE5MzkwMzI3ODl9...
```

**⚠️ WARNING:** This key has admin access! Never expose it in client-side code or commit it to Git.

---

## 5. JWT_SECRET

**How to generate:**
This is a secret key you create yourself. Use a strong, random string.

### Option A: Generate using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Option B: Generate using OpenSSL
```bash
openssl rand -base64 32
```

### Option C: Use Online Generator
- Visit: [randomkeygen.com](https://randomkeygen.com)
- Use "CodeIgniter Encryption Keys" - copy a 32+ character key

### Option D: Generate manually
- Use a password manager to generate a 32+ character random string
- Mix of letters, numbers, and special characters

**Example:**
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**⚠️ IMPORTANT:** 
- Make it at least 32 characters long
- Use different secrets for development and production
- Store securely - you'll need it if you reset tokens

---

## 6. CORS_ORIGIN

**What it is:**
The URL of your frontend application that will make requests to the backend.

**Options:**

### For Development:
```
CORS_ORIGIN=http://localhost:3000
```

### For Railway Frontend (if deployed):
```
CORS_ORIGIN=https://your-frontend-app.railway.app
```

### For Custom Domain:
```
CORS_ORIGIN=https://yourdomain.com
```

### Auto-detect Railway domain:
If you leave `CORS_ORIGIN` empty, the backend will automatically use your Railway domain:
```
CORS_ORIGIN=  (leave empty)
```

**Note:** If your frontend and backend are on the same Railway domain, you can leave it empty.

---

## 7. PINECONE_ENVIRONMENT

**Where to find:**
1. Go to [pinecone.io](https://pinecone.io)
2. Sign in to your account
3. Click on your project (or create a new one)
4. Go to **API Keys** section
5. Copy the **Environment** value (looks like: `us-east1-gcp`, `us-west1-gcp`, etc.)

**Example:**
```
PINECONE_ENVIRONMENT=us-east1-gcp
```

**Common environments:**
- `us-east1-gcp`
- `us-west1-gcp`
- `us-central1-gcp`
- `eu-west1-gcp`
- `asia-southeast1-gcp`

**Note:** This is optional for Phase 1.1 - you'll need it later when implementing vector database features.

---

## 8. PINECONE_INDEX_NAME

**What it is:**
The name of your Pinecone index (database) for storing embeddings.

**How to set:**
1. This is a name you choose yourself
2. Can be any lowercase alphanumeric string with hyphens
3. If you haven't created an index yet, use the default:

**Default value:**
```
PINECONE_INDEX_NAME=queryai-embeddings
```

**To create an index:**
1. Go to Pinecone Dashboard
2. Click **Create Index**
3. Name it: `queryai-embeddings`
4. Choose dimensions: `1536` (for OpenAI embeddings) or `3072` (for larger embeddings)
5. Choose metric: `cosine`
6. Select your environment
7. Create the index

**Example:**
```
PINECONE_INDEX_NAME=queryai-embeddings
```

**Note:** This is optional for Phase 1.1 - you'll need it later when implementing vector database features.

---

## Additional Variables You May Need

### OPENAI_API_KEY
**Where to find:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in to your account
3. Click on your profile → **API Keys**
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)

**Example:**
```
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890
```

### TAVILY_API_KEY (Optional)
**Where to find:**
1. Go to [tavily.com](https://tavily.com)
2. Sign up / Sign in
3. Go to **API Keys** section
4. Create a new API key
5. Copy the key

**Example:**
```
TAVILY_API_KEY=tvly-abcdefghijklmnopqrstuvwxyz123456
```

### PINECONE_API_KEY (Optional)
**Where to find:**
1. Go to [pinecone.io](https://pinecone.io)
2. Sign in → Your project
3. Go to **API Keys** section
4. Copy the **API Key** value

**Example:**
```
PINECONE_API_KEY=12345678-1234-1234-1234-123456789012
```

---

## Quick Reference Checklist

For Railway deployment, you need:

### ✅ Required for Phase 1.1 (Backend Foundation):
- [x] `NODE_ENV=development` ← You set this
- [x] `SUPABASE_URL` ← From Supabase Dashboard → Settings → API
- [x] `SUPABASE_ANON_KEY` ← From Supabase Dashboard → Settings → API (anon key)
- [x] `SUPABASE_SERVICE_ROLE_KEY` ← From Supabase Dashboard → Settings → API (service_role key)
- [x] `OPENAI_API_KEY` ← From OpenAI Platform → API Keys
- [x] `JWT_SECRET` ← Generate using `openssl rand -base64 32`
- [x] `CORS_ORIGIN` ← Your frontend URL or leave empty for Railway auto-detect

### 📋 Optional (for later phases):
- [ ] `ANTHROPIC_API_KEY` ← From Anthropic Dashboard (for Claude)
- [ ] `TAVILY_API_KEY` ← From Tavily Dashboard (for search)
- [ ] `PINECONE_API_KEY` ← From Pinecone Dashboard (for vectors)
- [ ] `PINECONE_ENVIRONMENT` ← From Pinecone Dashboard
- [ ] `PINECONE_INDEX_NAME=queryai-embeddings` ← You choose this

---

## Railway Setup Instructions

1. **Go to Railway Dashboard** → Your Project → Your Service → **Variables** tab

2. **Add each variable:**
   - Click **"New Variable"**
   - Enter the variable name (e.g., `NODE_ENV`)
   - Enter the value (e.g., `development`)
   - Click **"Add"**

3. **Verify all variables are set:**
   - Check the Variables list
   - Ensure no required variables are missing

4. **Redeploy if needed:**
   - Railway automatically redeploys when you change variables
   - Or click **"Deploy"** to trigger a new deployment

---

## Security Notes

🔒 **Never commit these to Git:**
- `SUPABASE_SERVICE_ROLE_KEY` (has admin access)
- `JWT_SECRET` (used for token signing)
- `OPENAI_API_KEY` (costs money if exposed)
- Any API keys

✅ **Safe to expose:**
- `SUPABASE_ANON_KEY` (designed for client-side use)
- `NODE_ENV` (just tells environment type)
- `CORS_ORIGIN` (just a URL)

---

## Need Help?

- **Supabase:** [docs.supabase.com](https://docs.supabase.com)
- **OpenAI:** [platform.openai.com/docs](https://platform.openai.com/docs)
- **Pinecone:** [docs.pinecone.io](https://docs.pinecone.io)
- **Railway:** [docs.railway.app](https://docs.railway.app)

---

**Ready to set up?** Use this guide to collect all your API keys, then add them to Railway!
