# Setting Up Separate Railway Service for Renewal Cron Job

## Overview

Create a **separate Railway service** specifically for running the renewal cron job. This keeps your main backend service running as an HTTP server, while the cron job runs on schedule.

## Step 1: Create New Service in Railway

1. Go to [Railway Dashboard](https://railway.app)
2. Select your **QueryAI project**
3. Click **"+ New"** → **"GitHub Repo"** (or **"Empty Service"**)
4. If using GitHub Repo:
   - Select the same repository
   - Set **Root Directory** to: `backend`
5. Name it: **"QueryAI Renewal Cron"** (or similar)

## Step 2: Configure the Cron Service

### Settings Tab:

1. **Root Directory:** `backend`
2. **Start Command:** 
   ```
   node -e "require('./dist/jobs/renewal-job').runRenewalJobAndExit()"
   ```
3. **Cron Schedule:** `0 0 * * *` (daily at midnight UTC)
   - Or use: `0 2 * * *` for 2 AM UTC
   - Format: `minute hour day month day-of-week`

### Variables Tab:

Copy **ALL** environment variables from your main backend service:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `JWT_SECRET`
- `NODE_ENV=production`
- Any other variables your renewal job needs

**Important:** 
- ❌ **DO NOT** set `RAILWAY_CRON=true` - Railway handles this via Cron Schedule
- ✅ Copy all database and service credentials
- ✅ Set `NODE_ENV=production`

## Step 3: Verify Setup

1. **Service Status:** Should show "Ready" (this is normal for cron services)
2. **Cron Schedule:** Should show "Next run in X hours"
3. **Recent Executions:** Will be empty until first run

## Step 4: Test Manually (Optional)

You can test the cron job manually:

1. Go to **Cron Runs** tab
2. Click **"Run now"** button
3. Check logs to verify it runs successfully
4. Should see: "Renewal job completed successfully"

## Service Comparison

| Feature | Main Backend Service | Cron Service |
|---------|---------------------|-------------|
| **Purpose** | Serve HTTP API | Run renewal job |
| **Status** | "Online" | "Ready" |
| **Start Command** | `npm start` | `node -e "require('./dist/jobs/renewal-job').runRenewalJobAndExit()"` |
| **Cron Schedule** | None | `0 0 * * *` |
| **RAILWAY_CRON** | ❌ Not set | ❌ Not set |
| **Environment Variables** | All backend vars | Same as backend |

## Important Notes

1. **Two Separate Services:**
   - Main backend: Serves HTTP API (status: "Online")
   - Cron service: Runs renewal job (status: "Ready")

2. **Cron Service Behavior:**
   - Runs the job
   - Exits after completion
   - Railway restarts it on schedule
   - Status "Ready" is normal (not serving HTTP)

3. **Environment Variables:**
   - Both services need database credentials
   - Both need service role keys
   - Cron service doesn't need CORS_ORIGIN, PORT, etc.

## Troubleshooting

### Cron Job Not Running

1. Check **Cron Schedule** is set correctly
2. Check **Start Command** is correct
3. Verify service has all required environment variables
4. Check logs for errors

### Cron Job Fails

1. Check Railway logs for error messages
2. Verify all environment variables are set
3. Test manually using "Run now" button
4. Check database connection is working

### Service Status "Ready" Instead of "Online"

- ✅ **This is normal** for cron services
- Cron services exit after running, so they show "Ready"
- Main backend should be "Online"

## Quick Checklist

- [ ] Created new Railway service for cron
- [ ] Set Root Directory to `backend`
- [ ] Set Start Command to renewal job command
- [ ] Set Cron Schedule to `0 0 * * *`
- [ ] Copied all environment variables from main backend
- [ ] Did NOT set `RAILWAY_CRON=true`
- [ ] Tested manually with "Run now"
- [ ] Verified logs show successful execution

---

**Last Updated:** 2026-01-25
