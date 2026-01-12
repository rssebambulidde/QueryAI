# Railway Deployment Verification Guide

## Overview

Since you're already deployed on Railway, this guide helps verify your deployment is properly configured and running.

## Pre-Deployment Checklist

### ✅ Backend Service

#### Environment Variables
Verify all required variables are set in Railway:

**Required:**
- [ ] `NODE_ENV` - Set to `development` or `production`
- [ ] `PORT` - Automatically set by Railway (usually 3001)
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `OPENAI_API_KEY` - OpenAI API key (for AI features)
- [ ] `JWT_SECRET` - Secure random string
- [ ] `CORS_ORIGIN` - Frontend URL (e.g., `https://your-frontend.railway.app`)

**Optional:**
- [ ] `LOG_LEVEL` - Logging level (default: `info`)
- [ ] `API_BASE_URL` - Backend URL (auto-detected from Railway)

#### Build Configuration
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm run build` (or auto-detected)
- [ ] Start Command: `npm start` (or auto-detected)

#### Health Check
- [ ] Health endpoint: `GET /health` returns 200
- [ ] Root endpoint: `GET /` returns API info

---

### ✅ Frontend Service (if deployed separately)

#### Environment Variables
- [ ] `NEXT_PUBLIC_API_URL` - Backend API URL
- [ ] `NEXT_PUBLIC_APP_NAME` - App name (optional)

#### Build Configuration
- [ ] Root Directory: `frontend`
- [ ] Build Command: `npm run build` (auto-detected)
- [ ] Start Command: `npm start` (auto-detected)
- [ ] Output Directory: `.next` (auto-detected)

---

## Verification Steps

### 1. Check Backend Health

```bash
# Replace with your Railway backend URL
curl https://your-backend.railway.app/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server health check",
  "timestamp": "2026-01-11T...",
  "environment": "development",
  "uptime": 123.45,
  "database": {
    "connected": true,
    "message": "Database connection healthy"
  }
}
```

### 2. Check API Endpoints

```bash
# Root endpoint
curl https://your-backend.railway.app/

# API info
curl https://your-backend.railway.app/api
```

**Expected:** JSON response with endpoint information

### 3. Test Authentication Endpoints

```bash
# Signup
curl -X POST https://your-backend.railway.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Login
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

**Expected:** Success response with user and session data

### 4. Test AI Endpoints (requires auth)

```bash
# Get token from login response first
TOKEN="your-access-token"

# Test AI endpoint
curl -X POST https://your-backend.railway.app/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What is AI?"}'
```

**Expected:** AI response with answer

### 5. Check Frontend (if deployed)

```bash
# Visit frontend URL
https://your-frontend.railway.app
```

**Expected:**
- ✅ Home page loads
- ✅ Can navigate to login/signup
- ✅ Can login and access dashboard
- ✅ Chat interface works

---

## Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution:**
- Check `SUPABASE_URL` and keys are correct
- Verify Supabase project is active
- Check network connectivity

### Issue: "OpenAI API error"
**Solution:**
- Verify `OPENAI_API_KEY` is set and valid
- Check API key has sufficient credits
- Verify key format: `sk-...`

### Issue: "CORS error"
**Solution:**
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Check for trailing slashes
- Ensure credentials are allowed

### Issue: "Build failed"
**Solution:**
- Check build logs in Railway
- Verify all dependencies in `package.json`
- Check Node.js version matches (>=20.0.0)

### Issue: "Port already in use"
**Solution:**
- Railway automatically sets PORT
- Don't hardcode port in code
- Use `process.env.PORT`

---

## Monitoring

### Railway Dashboard
- [ ] Check deployment logs
- [ ] Monitor resource usage
- [ ] Check error logs
- [ ] Verify environment variables

### Application Logs
- [ ] Backend logs accessible
- [ ] Error logs visible
- [ ] Request logs working

---

## Production Checklist

Before marking as production-ready:

- [ ] All environment variables set
- [ ] `NODE_ENV=production` (for production)
- [ ] Strong `JWT_SECRET` set
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Error handling working
- [ ] Logging configured
- [ ] Health checks passing
- [ ] All endpoints tested
- [ ] Frontend connected to backend
- [ ] Authentication flow working
- [ ] AI endpoints working

---

## Quick Verification Script

Save as `verify-deployment.sh`:

```bash
#!/bin/bash

BACKEND_URL="https://your-backend.railway.app"

echo "Testing Backend Health..."
curl -s "$BACKEND_URL/health" | jq '.'

echo -e "\nTesting API Info..."
curl -s "$BACKEND_URL/api" | jq '.'

echo -e "\nTesting Root Endpoint..."
curl -s "$BACKEND_URL/" | jq '.'
```

Run: `bash verify-deployment.sh`

---

## Success Criteria

✅ All endpoints responding
✅ Health check passing
✅ Authentication working
✅ AI endpoints functional
✅ Frontend connected
✅ No critical errors in logs
✅ Environment variables correct

---

## Next Steps

After verification:
1. ✅ Document any issues found
2. ✅ Fix any configuration problems
3. ✅ Re-test after fixes
4. ✅ Update documentation
5. ✅ Proceed to next phase
