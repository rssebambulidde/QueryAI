# Fixing "Network Error" on Login - Cloudflare Pages

## Problem

Login fails with "Network Error" message even though your network connection is working.

## Root Cause

The frontend is trying to connect to `http://localhost:3001` (the default API URL) instead of your actual Railway backend URL. This happens when `NEXT_PUBLIC_API_URL` is not set in Cloudflare Pages environment variables.

## Solution

### Step 1: Get Your Backend URL

1. Go to [Railway Dashboard](https://railway.app)
2. Select your backend service
3. Go to **Settings** → **Networking**
4. Copy your **Public Domain** (e.g., `queryai-production.up.railway.app`)

### Step 2: Configure Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages**
2. Select your QueryAI frontend project
3. Go to **Settings** → **Environment Variables**
4. Click **Add variable**
5. Add the following:

   **Variable Name:** `NEXT_PUBLIC_API_URL`
   
   **Value:** `https://your-backend-url.railway.app`
   
   **Example:** `https://queryai-production.up.railway.app`

6. Make sure it's set for **Production** environment
7. Click **Save**

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest deployment
3. Or push a new commit to trigger a rebuild

### Step 4: Verify

1. After deployment completes, visit your Cloudflare Pages site
2. Try logging in
3. The network error should be resolved

## Alternative: Check Current Configuration

To verify what API URL is currently being used:

1. Open your browser's Developer Tools (F12)
2. Go to **Console** tab
3. Type: `console.log(process.env.NEXT_PUBLIC_API_URL)`
4. Check the value - it should be your Railway backend URL, not `localhost`

## Troubleshooting

### Still Getting Network Error?

1. **Verify Backend is Running:**
   - Check Railway logs to ensure backend is up
   - Visit `https://your-backend-url.railway.app/health` in browser
   - Should return: `{"status":"healthy",...}`

2. **Check CORS Configuration:**
   - In Railway backend, verify `CORS_ORIGIN` includes your Cloudflare Pages URL
   - Example: `CORS_ORIGIN=https://your-frontend.pages.dev,https://yourdomain.com`

3. **Check Browser Console:**
   - Open Developer Tools (F12) → **Network** tab
   - Try logging in
   - Look for failed requests
   - Check the error message and status code

4. **Verify Environment Variable:**
   - In Cloudflare Pages → Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_API_URL` is set correctly
   - No trailing slash: `https://your-backend.railway.app` (not `https://your-backend.railway.app/`)

5. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache and cookies

## Common Mistakes

❌ **Wrong:** `NEXT_PUBLIC_API_URL=http://localhost:3001` (won't work in production)
✅ **Correct:** `NEXT_PUBLIC_API_URL=https://queryai-production.up.railway.app`

❌ **Wrong:** `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/` (trailing slash)
✅ **Correct:** `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`

❌ **Wrong:** Setting variable in wrong environment (e.g., Preview instead of Production)
✅ **Correct:** Set for **Production** environment

## Quick Checklist

- [ ] Backend is deployed and running on Railway
- [ ] Backend URL is accessible (test `/health` endpoint)
- [ ] `NEXT_PUBLIC_API_URL` is set in Cloudflare Pages
- [ ] Value is your Railway backend URL (https://...)
- [ ] No trailing slash in URL
- [ ] Set for Production environment
- [ ] Redeployed after adding variable
- [ ] Cleared browser cache

## Still Need Help?

If the issue persists:

1. Check Railway backend logs for incoming requests
2. Check Cloudflare Pages build logs
3. Verify both services are deployed and running
4. Test backend API directly: `curl https://your-backend.railway.app/api/auth/login`

---

**Last Updated:** 2026-01-25
