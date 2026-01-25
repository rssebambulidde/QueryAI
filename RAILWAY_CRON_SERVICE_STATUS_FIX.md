# Fix: Service Status "Ready" Instead of "Online" - Cron Job Issue

## Problem

Your backend service shows **"Ready"** instead of **"Online"**, and API requests are failing with CORS errors.

## Root Cause

If you set `RAILWAY_CRON=true` on your **main backend service**, the server will:
1. Run the renewal job
2. Exit immediately
3. **NOT start the HTTP server**

This means your backend can't serve API requests, causing:
- Service status: "Ready" (not "Online")
- CORS errors (backend not responding)
- Network errors (no server running)

## Solution: Remove RAILWAY_CRON from Main Service

### Step 1: Check Railway Variables

1. Go to Railway Dashboard → Your **Backend Service** (not cron service)
2. Go to **Variables** tab
3. Look for `RAILWAY_CRON`
4. **If it exists and is set to `true`:** DELETE IT or set it to `false`

### Step 2: Verify Service Restarts

After removing `RAILWAY_CRON`:
1. Railway will automatically redeploy
2. Service status should change to **"Online"**
3. HTTP server will start and serve API requests

### Step 3: Set Up Cron Job Correctly

**Option A: Separate Service (Recommended)**

1. Create a **NEW service** in Railway (separate from your backend)
2. Use the same codebase
3. Set **Start Command** to: `node -e "require('./dist/jobs/renewal-job').runRenewalJobAndExit()"`
4. Set **Cron Schedule** to: `0 0 * * *` (daily at midnight UTC)
5. **DO NOT** set `RAILWAY_CRON=true` - Railway handles it via Cron Schedule

**Option B: Use HTTP Endpoint (Alternative)**

Keep the main service as HTTP server, and use an external cron service to call:
```
POST https://your-backend.railway.app/api/jobs/renewals
```

## Important: Two Separate Services

- **Main Backend Service:** Serves HTTP API (should be "Online")
  - ❌ **DO NOT** set `RAILWAY_CRON=true` here
  - ✅ Should serve HTTP requests
  - ✅ Status should be "Online"

- **Cron Service (Separate):** Runs renewal job on schedule
  - ✅ Set Cron Schedule in Railway
  - ✅ Runs job and exits
  - ✅ Status will be "Ready" (this is OK for cron)

## Quick Fix Checklist

- [ ] Removed `RAILWAY_CRON=true` from main backend service
- [ ] Service status changed to "Online"
- [ ] Backend is serving HTTP requests
- [ ] Added `https://queryai-frontend.pages.dev` to `CORS_ORIGIN`
- [ ] Tested login - should work now

## Verify Backend is Running

**Test in browser:**
```
https://queryai-production.up.railway.app/health
```

**Should return:**
```json
{"status":"healthy",...}
```

**If this works:** Backend is running correctly ✅

**If this fails:** Backend is not serving HTTP requests ❌

---

**Last Updated:** 2026-01-25
