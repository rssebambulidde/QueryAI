# Cloudflare Custom Domain Setup Guide

## Problem
After connecting a custom domain (e.g., `https://queryai.samabrains.com/`), you're getting a network error at login:
> "Network Error: Unable to connect to the API server. Please check your internet connection and ensure the backend is running."

## Root Cause
The frontend is trying to connect to `http://localhost:3001` (the default API URL) because `NEXT_PUBLIC_API_URL` environment variable is not configured in Cloudflare Pages.

## Solution

### Step 1: Configure Frontend API URL in Cloudflare Pages

1. **Go to Cloudflare Dashboard:**
   - Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Go to **Pages** → Your QueryAI project

2. **Add Environment Variable:**
   - Click on **Settings** → **Environment Variables**
   - Click **Add variable**
   - Add the following:
     - **Variable name:** `NEXT_PUBLIC_API_URL`
     - **Value:** Your backend API URL (e.g., `https://your-backend.railway.app` or your backend domain)
     - **Environment:** Select **Production** (and **Preview** if needed)

3. **Redeploy:**
   - After adding the environment variable, you need to trigger a new deployment
   - Go to **Deployments** tab
   - Click **Retry deployment** on the latest deployment, OR
   - Push a new commit to trigger a fresh build

### Step 2: Update Backend CORS Settings

Your backend needs to allow requests from your new custom domain.

1. **Go to Railway Dashboard** (or wherever your backend is hosted):
   - Navigate to your backend service
   - Go to **Variables** tab

2. **Update CORS_ORIGIN:**
   - Find or add the `CORS_ORIGIN` environment variable
   - Update it to include your custom domain:
     ```
     CORS_ORIGIN=https://queryai.samabrains.com
     ```
   - If you have multiple origins, separate them with commas:
     ```
     CORS_ORIGIN=https://queryai.samabrains.com,https://your-project.pages.dev
     ```

3. **Redeploy Backend:**
   - Railway will automatically redeploy when you update environment variables
   - Wait for the deployment to complete

### Step 3: Verify Configuration

1. **Check Frontend Environment Variable:**
   - After redeploying, open your custom domain in a browser
   - Open browser DevTools (F12) → Console
   - You should see: `[API Client] Using API URL: https://your-backend.railway.app`
   - If you see `localhost`, the environment variable wasn't set correctly

2. **Test Login:**
   - Try logging in again
   - The network error should be resolved

3. **Check Network Tab:**
   - Open DevTools → Network tab
   - Try logging in
   - Look for requests to `/api/auth/login`
   - The request URL should be: `https://your-backend.railway.app/api/auth/login`
   - If it's `http://localhost:3001/api/auth/login`, the environment variable isn't working

## Troubleshooting

### Issue: Still seeing localhost in console logs

**Solution:**
- `NEXT_PUBLIC_*` variables are embedded at **build time** in Next.js
- You must **rebuild/redeploy** after adding the variable
- Just adding the variable won't update an already-built deployment

### Issue: CORS errors in browser console

**Error:** `Access to fetch at 'https://your-backend.railway.app' from origin 'https://queryai.samabrains.com' has been blocked by CORS policy`

**Solution:**
- Verify `CORS_ORIGIN` in backend includes your custom domain
- Make sure there are no typos in the domain
- Ensure backend has been redeployed after updating CORS_ORIGIN

### Issue: Environment variable not working

**Check:**
1. Variable name is exactly: `NEXT_PUBLIC_API_URL` (case-sensitive)
2. Variable is set for the correct environment (Production/Preview)
3. You've triggered a new deployment after adding the variable
4. The backend URL is correct and accessible

### Issue: Backend not accessible

**Test:**
- Open `https://your-backend.railway.app/api/health` in a browser
- Should return a JSON response
- If it doesn't, your backend might be down or the URL is wrong

## Quick Checklist

- [ ] Added `NEXT_PUBLIC_API_URL` in Cloudflare Pages environment variables
- [ ] Set value to your backend API URL (e.g., `https://your-backend.railway.app`)
- [ ] Triggered a new deployment in Cloudflare Pages
- [ ] Updated `CORS_ORIGIN` in backend to include `https://queryai.samabrains.com`
- [ ] Backend redeployed with new CORS settings
- [ ] Verified frontend console shows correct API URL (not localhost)
- [ ] Tested login - no network errors

## Example Configuration

### Cloudflare Pages Environment Variables:
```
NEXT_PUBLIC_API_URL=https://queryai-backend.railway.app
```

### Backend (Railway) Environment Variables:
```
CORS_ORIGIN=https://queryai.samabrains.com,https://queryai.pages.dev
API_BASE_URL=https://queryai-backend.railway.app
```

## Notes

- **Important:** `NEXT_PUBLIC_*` variables are embedded at build time. You must rebuild after changing them.
- **CORS:** Backend must explicitly allow your frontend domain in `CORS_ORIGIN`
- **HTTPS:** Always use `https://` URLs in production (not `http://`)
- **Multiple Environments:** You can set different values for Production and Preview environments in Cloudflare Pages

---

**Last Updated:** January 25, 2026
