# Fix Network Error on Cloudflare Pages

## 🔴 Problem
The frontend is deployed but shows "Network Error" when trying to login because:
1. `NEXT_PUBLIC_API_URL` is not set in Cloudflare Pages (defaults to `http://localhost:3001`)
2. Backend CORS doesn't allow requests from Cloudflare Pages domain

---

## ✅ Solution: Two Steps

### Step 1: Add Environment Variable in Cloudflare Pages

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → Your project
2. Click **Settings** → **Environment variables**
3. Click **Add variable**
4. Add:
   - **Variable name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://your-backend.railway.app` (replace with your actual Railway backend URL)
   - **Environment:** Production (or All environments)
5. Click **Save**
6. **Redeploy** your site (go to **Deployments** → click the three dots on latest deployment → **Retry deployment**)

**Example:**
```
NEXT_PUBLIC_API_URL=https://queryai-production.up.railway.app
```

---

### Step 2: Update Backend CORS in Railway

1. Go to **Railway Dashboard** → Your backend service
2. Click **Variables** tab
3. Find `CORS_ORIGIN` variable
4. Update it to include your Cloudflare Pages domain:

**If CORS_ORIGIN is currently:**
```
https://old-frontend.railway.app
```

**Change it to (comma-separated):**
```
https://old-frontend.railway.app,https://queryai-frontend.pages.dev
```

**Or if you're only using Cloudflare now:**
```
https://queryai-frontend.pages.dev
```

5. Click **Save** (Railway will automatically redeploy)

---

## 🧪 Verify It Works

1. Wait for both deployments to complete
2. Open your Cloudflare Pages site: `https://queryai-frontend.pages.dev`
3. Try to login
4. The "Network Error" should be gone!

---

## 🔍 Troubleshooting

### Still getting Network Error?

1. **Check browser console** (F12 → Console tab):
   - Look for CORS errors
   - Check if API URL is correct

2. **Verify environment variable:**
   - In Cloudflare Pages, go to **Deployments** → Latest deployment → **Build logs**
   - Search for `NEXT_PUBLIC_API_URL` to confirm it's set

3. **Test backend directly:**
   - Open: `https://your-backend.railway.app/health`
   - Should return JSON with `"success": true`

4. **Check CORS in backend:**
   - In Railway backend logs, look for CORS errors
   - Verify `CORS_ORIGIN` includes your Cloudflare domain

---

## 📝 Quick Reference

**Cloudflare Pages URL:** `https://queryai-frontend.pages.dev`  
**Railway Backend URL:** `https://your-backend.railway.app` (replace with yours)

**Environment Variables Needed:**

**Cloudflare Pages:**
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Railway Backend:**
```
CORS_ORIGIN=https://queryai-frontend.pages.dev
```
(Or comma-separated if you have multiple frontends)

---

**That's it!** After these two steps, your login should work. 🎉
