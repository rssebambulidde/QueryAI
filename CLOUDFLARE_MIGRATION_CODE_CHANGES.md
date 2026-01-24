# Cloudflare Pages Migration - Code Changes Guide
**Implement code changes to enable Cloudflare Pages deployment**

This guide covers the code changes needed after completing the infrastructure setup in `CLOUDFLARE_MIGRATION_SETUP.md`.

---

## 📋 **Prerequisites**

- [x] Cloudflare Pages project created
- [x] Cloudflare Pages URL: `https://queryai-frontend.pages.dev`
- [x] `NEXT_PUBLIC_API_URL` set in Cloudflare Pages
- [x] Railway backend `CORS_ORIGIN` value documented

---

## 🎯 **Overview of Changes**

1. ✅ **Backend CORS** - Support multiple origins (comma-separated)
2. ✅ **Frontend Cloudflare Adapter** - Add `@opennextjs/cloudflare` (OpenNext)
3. ✅ **Next.js Configuration** - Update for Cloudflare compatibility
4. ⏳ **Cloudflare Pages Build Command** - Update to use adapter
5. ⏳ **Railway CORS_ORIGIN** - Add Cloudflare URL

---

## 🔧 **Step 1: Backend CORS Updates (COMPLETED)**

### Changes Made

**File: `backend/src/server.ts`**
- Updated CORS configuration to parse comma-separated origins from `CORS_ORIGIN`
- Now supports multiple frontend URLs (Railway + Cloudflare)

**File: `backend/src/config/env.ts`**
- Updated comment to reflect multi-origin support

### How It Works

The backend now parses `CORS_ORIGIN` as comma-separated values:
```
CORS_ORIGIN=https://railway-frontend.up.railway.app,https://queryai-frontend.pages.dev
```

Both origins will be allowed for CORS requests.

---

## 🔧 **Step 2: Frontend Cloudflare Adapter (COMPLETED)**

### Changes Made

**File: `frontend/package.json`**
- Added `@opennextjs/cloudflare` to devDependencies (OpenNext Cloudflare adapter)
- Added `build:cloudflare` script

### What This Does

The OpenNext Cloudflare adapter (`@opennextjs/cloudflare`) converts Next.js output to Cloudflare Pages-compatible format. It:
- Converts Next.js routes to Cloudflare Pages Functions
- Handles middleware/proxy for Cloudflare Workers
- Optimizes static assets for Cloudflare CDN
- **Note:** This replaces the deprecated `@cloudflare/next-on-pages` package

---

## 🔧 **Step 3: Next.js Configuration (COMPLETED)**

### Changes Made

**File: `frontend/next.config.ts`**
- Added comment about Cloudflare adapter
- No additional config needed (adapter handles it automatically)

---

## 🚀 **Step 4: Update Cloudflare Pages Build Settings**

**Time estimate:** 2 minutes

### 4.1 Update Build Command

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → Your Project
2. Click **Settings** → **Builds & deployments**
3. Update **Build command** to:
   ```
   npm install && npm run build && npx @opennextjs/cloudflare build
   ```
   (This builds Next.js first, then runs the OpenNext Cloudflare adapter)

   **Alternative:** You can also use the script we added:
   ```
   npm install && npm run build:cloudflare
   ```
   (Both commands do the same thing)

### 4.2 Update Build Output Directory

1. In the same settings page
2. Update **Build output directory** to:
   ```
   .opennext
   ```
   (The OpenNext Cloudflare adapter outputs to `.opennext` directory)

### 4.3 Save and Redeploy

1. Click **Save**
2. Go to **Deployments** tab
3. Click **Retry deployment** on the latest failed build, or push a new commit to trigger a new build

---

## 🔧 **Step 5: Update Railway Backend CORS**

**Time estimate:** 3 minutes

### 5.1 Get Current CORS_ORIGIN Value

1. Go to **Railway Dashboard** → Your Backend Service
2. Click **Variables** tab
3. Find `CORS_ORIGIN` and note the current value

**Current value:** `_________________________________`

### 5.2 Update CORS_ORIGIN

1. Click **Edit** on `CORS_ORIGIN`
2. Add your Cloudflare Pages URL (comma-separated):
   ```
   https://your-railway-frontend.up.railway.app,https://queryai-frontend.pages.dev
   ```
   (Replace with your actual Railway frontend URL)

3. Click **Save**

**⚠️ Important:**
- Keep your Railway frontend URL in the list (for transition period)
- Add Cloudflare URL after a comma
- No spaces around commas (or spaces are fine, backend trims them)
- Both URLs should include `https://`

### 5.3 Verify Backend Restart

Railway will automatically restart your backend service after updating environment variables. Wait ~30 seconds for the restart to complete.

---

## 🧪 **Step 6: Test the Deployment**

### 6.1 Test Cloudflare Pages Build

1. Check **Cloudflare Pages** → **Deployments** tab
2. Verify build succeeds (should show "Success" status)
3. If it fails, check build logs for errors

### 6.2 Test Cloudflare Pages Site

1. Visit your Cloudflare Pages URL: `https://queryai-frontend.pages.dev`
2. Open browser DevTools → Console
3. Check for errors

### 6.3 Test Backend Connection

1. On Cloudflare Pages site, try to:
   - Login
   - Sign up
   - Make an API call
2. Check **Network** tab in DevTools:
   - Requests should go to Railway backend
   - No CORS errors
   - Responses received successfully

### 6.4 Test CORS

1. Open browser DevTools → Console
2. Run:
   ```javascript
   fetch('https://your-backend.railway.app/api/health', {
     method: 'GET',
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```
3. Should return health status without CORS errors

---

## ✅ **Step 7: Verification Checklist**

Before considering migration complete:

- [ ] Cloudflare Pages build succeeds
- [ ] Cloudflare Pages site loads without errors
- [ ] Login works from Cloudflare Pages
- [ ] API calls work from Cloudflare Pages
- [ ] No CORS errors in browser console
- [ ] Railway frontend still works (if keeping it)
- [ ] Backend `CORS_ORIGIN` includes both URLs
- [ ] Environment variables set correctly

---

## 🔍 **Troubleshooting**

### Issue: Cloudflare build fails - "Cannot find module @opennextjs/cloudflare"

**Solution:**
1. Make sure `package.json` includes `@opennextjs/cloudflare` in devDependencies
2. Run `npm install` locally to update `package-lock.json`
3. Commit and push `package-lock.json`
4. Redeploy on Cloudflare

### Issue: Build output directory not found

**Solution:**
1. Check build command uses `npm run build:cloudflare` or `npx @opennextjs/cloudflare build`
2. Verify output directory is `.opennext`
3. Check build logs to see where files are actually output

### Issue: CORS errors from Cloudflare Pages

**Solution:**
1. Verify `CORS_ORIGIN` in Railway includes Cloudflare URL
2. Check format: `url1,url2` (comma-separated, no spaces or with spaces)
3. Verify backend restarted after updating CORS_ORIGIN
4. Check backend logs for CORS errors

### Issue: Site loads but API calls fail

**Solution:**
1. Check `NEXT_PUBLIC_API_URL` in Cloudflare Pages environment variables
2. Verify it's set to your Railway backend URL
3. Redeploy after adding/updating environment variable
4. Check browser console for API errors

### Issue: Middleware/proxy not working

**Solution:**
1. The Cloudflare adapter should handle middleware automatically
2. If issues persist, check Cloudflare Pages Functions logs
3. Verify `middleware.ts` is in the correct location (`frontend/middleware.ts`)

---

## 📚 **Reference**

### Build Output Structure

After `build:cloudflare`, the output structure is:
```
.opennext/
  static/            # Static files (HTML, CSS, JS)
  server/            # Server-side code
  functions/         # Cloudflare Pages Functions (API routes, middleware)
```

### Environment Variables

**Cloudflare Pages:**
- `NEXT_PUBLIC_API_URL` - Railway backend URL

**Railway Backend:**
- `CORS_ORIGIN` - Comma-separated frontend URLs

---

## 🎉 **Migration Complete!**

Once all steps are complete:

1. ✅ Cloudflare Pages is serving your frontend
2. ✅ Backend accepts requests from Cloudflare
3. ✅ All features working correctly

### Optional: Cleanup

After verifying Cloudflare Pages works perfectly:

1. **Keep Railway frontend running** for a few days as backup
2. **Monitor Cloudflare Pages** for any issues
3. **Once confident**, you can:
   - Remove Railway frontend service (optional)
   - Update `CORS_ORIGIN` to only include Cloudflare URL (optional)

---

## ⚠️ **Important Notes**

1. **Keep Railway frontend** during transition - Don't delete it immediately
2. **Test thoroughly** - Verify all features work on Cloudflare
3. **Monitor both** - Keep an eye on both deployments initially
4. **Backend stays on Railway** - Only frontend moves to Cloudflare
5. **Environment variables** - Must be set in Cloudflare dashboard
6. **Build command** - Must use `build:cloudflare` script or `@opennextjs/cloudflare build`

---

**Next:** Test your deployment and verify everything works! 🚀
