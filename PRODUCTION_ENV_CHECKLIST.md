# Production Environment Variables Checklist

## Overview

Complete checklist of all environment variables needed for production deployment on Railway.

---

## Backend Environment Variables

### Required Variables

#### Server Configuration
```env
NODE_ENV=production
PORT=3001  # Auto-set by Railway, don't override
API_BASE_URL=https://your-backend.railway.app  # Optional, auto-detected
```

#### Database (Supabase)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find:**
- Supabase Dashboard → Settings → API
- Copy Project URL and both API keys

#### AI Services
```env
OPENAI_API_KEY=sk-proj-...
```

**Where to find:**
- https://platform.openai.com/api-keys
- Create new secret key

#### Authentication
```env
JWT_SECRET=your-very-secure-random-string-min-32-chars
JWT_EXPIRES_IN=7d
```

**Generate JWT_SECRET:**
```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 2: OpenSSL
openssl rand -base64 32
```

#### CORS
```env
CORS_ORIGIN=https://your-frontend.railway.app
```

**Important:**
- Must match frontend URL exactly
- No trailing slash
- Include protocol (https://)

#### Logging
```env
LOG_LEVEL=info  # Options: error, warn, info, debug
```

---

### Optional Variables (for future phases)

#### Additional AI Services
```env
ANTHROPIC_API_KEY=sk-ant-...  # For Claude
```

#### Search API
```env
TAVILY_API_KEY=tvly-...  # For web search
```

#### Vector Database
```env
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX_NAME=queryai-embeddings
```

---

## Frontend Environment Variables

### Required Variables

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Important:**
- Must start with `NEXT_PUBLIC_` to be accessible in browser
- Use full URL with protocol
- No trailing slash

### Optional Variables

```env
NEXT_PUBLIC_APP_NAME=QueryAI
```

---

## Railway Setup Instructions

### Backend Service

1. **Go to Railway Dashboard**
   - Select your backend service
   - Click "Variables" tab

2. **Add Each Variable**
   - Click "New Variable"
   - Enter variable name (e.g., `NODE_ENV`)
   - Enter value (e.g., `production`)
   - Click "Add"

3. **Verify All Variables**
   - Check list matches checklist above
   - Ensure no typos
   - Verify values are correct

4. **Redeploy**
   - Railway auto-redeploys on variable changes
   - Or manually trigger deployment

### Frontend Service (if separate)

1. **Go to Frontend Service**
   - Select frontend service
   - Click "Variables" tab

2. **Add Variables**
   - `NEXT_PUBLIC_API_URL` = Your backend URL
   - `NEXT_PUBLIC_APP_NAME` = QueryAI (optional)

3. **Redeploy**

---

## Security Checklist

### ✅ Secrets Protection
- [ ] Never commit `.env` files to Git
- [ ] All secrets in Railway Variables (not code)
- [ ] `JWT_SECRET` is strong and unique
- [ ] API keys are valid and have proper permissions

### ✅ CORS Configuration
- [ ] `CORS_ORIGIN` matches frontend URL exactly
- [ ] No wildcards in production
- [ ] Credentials properly configured

### ✅ Environment Separation
- [ ] Development and production use different keys
- [ ] `NODE_ENV` set correctly
- [ ] Test data separate from production

---

## Verification

### Test Each Variable

```bash
# Backend - Check health (verifies env vars loaded)
curl https://your-backend.railway.app/health

# Frontend - Check if API connection works
# Visit frontend and try to login
```

### Common Issues

**Issue: "Missing required environment variable"**
- Check variable name spelling
- Verify variable is set in Railway
- Check for extra spaces

**Issue: "Invalid API key"**
- Verify key is copied completely
- Check for leading/trailing spaces
- Verify key hasn't expired

**Issue: "CORS error"**
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Check protocol (http vs https)
- Verify no trailing slash

---

## Quick Reference

### Minimum Required (Backend)
```
NODE_ENV
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
JWT_SECRET
CORS_ORIGIN
```

### Minimum Required (Frontend)
```
NEXT_PUBLIC_API_URL
```

---

## Production vs Development

### Development
- `NODE_ENV=development`
- More verbose logging
- Less strict CORS
- Test API keys OK

### Production
- `NODE_ENV=production`
- Error logging only
- Strict CORS
- Production API keys required
- Strong secrets

---

## Success Criteria

✅ All required variables set
✅ No missing variable errors
✅ Backend health check passes
✅ Frontend connects to backend
✅ Authentication works
✅ AI endpoints work
✅ No security warnings

---

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify variable names match exactly
3. Check for typos in values
4. Ensure no extra spaces
5. Review error messages in logs
