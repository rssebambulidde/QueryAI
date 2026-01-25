# Quick Fix: CORS Error - Add Cloudflare Pages URL

## Problem

```
Access to XMLHttpRequest at 'https://queryai-production.up.railway.app/api/auth/login' 
from origin 'https://queryai-frontend.pages.dev' has been blocked by CORS policy
```

## Solution: Add Cloudflare Pages URL to Backend CORS

### Step 1: Go to Railway Backend Settings

1. Go to [Railway Dashboard](https://railway.app)
2. Select your **backend service** (QueryAI backend)
3. Go to **Variables** tab

### Step 2: Update CORS_ORIGIN

**Option A: Add to Existing CORS_ORIGIN (Recommended)**

If `CORS_ORIGIN` already exists:
1. Click on `CORS_ORIGIN` variable
2. Add your Cloudflare Pages URL (comma-separated):
   ```
   https://queryai-frontend.pages.dev,https://your-other-domain.com
   ```
3. Click **Save**

**Option B: Set CORS_ORIGIN if Missing**

If `CORS_ORIGIN` doesn't exist:
1. Click **New Variable**
2. **Name:** `CORS_ORIGIN`
3. **Value:** `https://queryai-frontend.pages.dev`
4. Click **Save**

**Option C: Use CLOUDFLARE_PAGES_URL (Alternative)**

1. Click **New Variable**
2. **Name:** `CLOUDFLARE_PAGES_URL`
3. **Value:** `queryai-frontend.pages.dev` (or `https://queryai-frontend.pages.dev`)
4. Click **Save**

### Step 3: Redeploy Backend

After updating the variable:
1. Railway will automatically redeploy
2. Or go to **Deployments** → Click **Redeploy**

### Step 4: Verify

1. Wait for deployment to complete
2. Try logging in again
3. CORS error should be resolved

## Example Configuration

**In Railway Variables:**

```
CORS_ORIGIN=https://queryai-frontend.pages.dev,https://yourdomain.com
```

Or:

```
CORS_ORIGIN=https://queryai-frontend.pages.dev
CLOUDFLARE_PAGES_URL=queryai-frontend.pages.dev
```

## Important Notes

- ✅ Use **full URL** with `https://`
- ✅ No trailing slash: `https://queryai-frontend.pages.dev` (not `https://queryai-frontend.pages.dev/`)
- ✅ Multiple origins: comma-separated (no spaces around commas)
- ✅ After changing, backend will auto-redeploy

## Quick Checklist

- [ ] Added `https://queryai-frontend.pages.dev` to `CORS_ORIGIN` in Railway
- [ ] Backend redeployed successfully
- [ ] Tried logging in again
- [ ] CORS error resolved

---

**Last Updated:** 2026-01-25
