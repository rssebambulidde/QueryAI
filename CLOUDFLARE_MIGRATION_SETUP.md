# Cloudflare Pages Migration - Setup Guide
**Configure Cloudflare Pages and Railway BEFORE code changes**

This guide walks you through setting up Cloudflare Pages and configuring Railway backend to support the migration, **without changing any code yet**.

---

## 📋 **Prerequisites**

- [ ] Cloudflare account (free tier works)
- [ ] Railway account (already have backend)
- [ ] GitHub repository access
- [ ] Backend Railway URL (e.g., `https://queryai-production.up.railway.app`)

---

## ⚡ **Quick Reference: What You'll Do**

### **In Cloudflare Dashboard:**
1. Create Pages project from GitHub repo
2. Set **Root directory:** `frontend` ⚠️ **Set this first!**
3. Set build command: `npm install && npm run build` (no `cd frontend` needed)
4. Add environment variable: `NEXT_PUBLIC_API_URL = https://your-backend.railway.app`
5. Get Cloudflare Pages URL (e.g., `https://queryai-frontend.pages.dev`)

### **In Railway Dashboard:**
1. Go to backend service (not frontend)
2. Note current `CORS_ORIGIN` value
3. Document Cloudflare URL (we'll update CORS in code phase)

**⚠️ No code changes yet!** Just infrastructure setup.

---

## 🎯 **Step 1: Create Cloudflare Pages Project**

**Time estimate:** 10-15 minutes

### 1.1 Sign in to Cloudflare
1. Go to https://dash.cloudflare.com
2. Sign in or create a free account
3. Navigate to **Workers & Pages** in the sidebar

### 1.2 Create New Pages Project
1. Click **"Create application"**
2. Select **"Pages"** tab
3. Click **"Connect to Git"**
4. Select your Git provider (GitHub/GitLab/Bitbucket)
5. Authorize Cloudflare to access your repositories
6. Select your **QueryAI repository**

### 1.3 Configure Project Settings
**Project name:** `queryai-frontend` (or your preferred name)

**Production branch:** `main` or `development` (match your Railway branch)

**Build settings:**
- **Framework preset:** `Next.js`
- **Root directory:** `frontend` ⚠️ **IMPORTANT: Set this first!**
- **Build command:** `npm install && npm run build` (NO `cd frontend` - root directory handles it)
- **Build output directory:** `.next` ⚠️ **Must be relative to root directory, not absolute!**

**⚠️ Critical:** 
- When Root directory is `frontend`, the output directory should be `.next` (relative, not `frontend/.next`)
- Cloudflare automatically resolves paths relative to the root directory
- If you see "frontend/frontend/.next" error, the output directory is set incorrectly

**⚠️ Critical:** 
- Set **Root directory** to `frontend` (this makes Cloudflare treat `frontend/` as the project root)
- Build command should NOT include `cd frontend` when root directory is set
- If root directory is set correctly, the build runs from `frontend/` automatically

**Alternative (if root directory doesn't work):**
- **Root directory:** `/` (root of repo)
- **Build command:** `cd frontend && npm install && npm run build`
- **Build output directory:** `frontend/.next`

### 1.4 Environment Variables (Initial Setup)
Click **"Save and Deploy"** first, then we'll add environment variables.

After first deployment, go to **Settings → Environment Variables**:

**Add:**
```
NEXT_PUBLIC_API_URL = https://your-backend.railway.app
```

**Replace `your-backend.railway.app` with your actual Railway backend URL.**

**⚠️ Important:** 
- Use your **production backend URL** (e.g., `https://queryai-production.up.railway.app`)
- Do NOT include trailing slash
- This will be used by your frontend to call the backend API

### 1.5 Get Your Cloudflare Pages URL
After deployment, Cloudflare will provide a URL like:
- `https://queryai-frontend.pages.dev` (default)
- Or custom domain if you configure one

**📝 Write down this URL:** `_________________________________`

---

## 🔧 **Step 2: Configure Railway Backend CORS**

**Time estimate:** 5 minutes

### 2.1 Get Your Cloudflare Pages URL
From Step 1.5, you should have your Cloudflare Pages URL.

**Example:** `https://queryai-frontend.pages.dev`

**📝 Write it down here:** `_________________________________`

### 2.2 Access Railway Backend Variables
1. Go to **Railway Dashboard**: https://railway.app
2. Select your **backend service** (the one running your Express API, NOT the frontend service)
3. Click on **Variables** tab (in the service settings)
4. Look for `CORS_ORIGIN` variable

### 2.3 Update CORS_ORIGIN Value

**⚠️ Important:** Your backend currently supports a **single origin** in `CORS_ORIGIN`. You have two options:

#### **Option A: Support Multiple Origins (Recommended for Transition)**

Update the backend code to support multiple origins (comma-separated). This allows both Railway and Cloudflare to work simultaneously.

**We'll do this in the code changes phase.** For now, document your Cloudflare URL.

#### **Option B: Switch CORS_ORIGIN to Cloudflare (When Ready)**

When you're ready to fully switch to Cloudflare, update `CORS_ORIGIN` to:

```
https://queryai-frontend.pages.dev
```

**⚠️ Note:** This will break Railway frontend access. Only do this after Cloudflare is fully working.

**For now (Setup Phase):**
- Keep current `CORS_ORIGIN` value (Railway frontend URL)
- Document your Cloudflare URL
- We'll update backend code in the next phase to support both

**Current CORS_ORIGIN value:** `_________________________________`

### 2.4 Verify Current CORS Configuration

**Note:** CORS won't work for Cloudflare yet (backend only supports single origin). We'll fix this in code changes phase.

**For now, just verify Railway backend is accessible:**
```bash
curl https://your-backend.railway.app/api/health
```

**Expected:** Should return health status (CORS test will work after backend code update).

---

## 🧪 **Step 3: Test Current Setup (Before Code Changes)**

### 3.1 Test Cloudflare Pages Deployment
1. Visit your Cloudflare Pages URL
2. Check browser console for errors
3. Verify environment variable is loaded:
   - Open browser DevTools → Console
   - Run: `console.log(process.env.NEXT_PUBLIC_API_URL)`
   - Should show your Railway backend URL

### 3.2 Test Backend Connection
1. Open Cloudflare Pages site
2. Try to make an API call (e.g., login)
3. Check Network tab in DevTools
4. Verify:
   - Request goes to Railway backend
   - No CORS errors
   - Response received

### 3.3 Expected Issues (Before Code Changes)
**These are expected and will be fixed after code changes:**

- ❌ Build might fail (Next.js SSR not fully compatible yet)
- ❌ Some features might not work (needs Cloudflare adapter)
- ✅ CORS should work (if configured correctly)
- ✅ Environment variables should load

**This is normal!** We're just setting up infrastructure first.

---

## 📝 **Step 4: Document Your Configuration**

### 4.1 Cloudflare Pages Info
```
Cloudflare Pages URL: https://_________________________________
Project Name: _________________________________
Repository: _________________________________
Branch: _________________________________
```

### 4.2 Railway Backend Info
```
Railway Backend URL: https://_________________________________
CORS_ORIGIN (updated): _________________________________
```

### 4.3 Environment Variables
```
NEXT_PUBLIC_API_URL: https://_________________________________
```

---

## ✅ **Step 5: Verification Checklist**

Before proceeding to code changes, verify:

- [ ] Cloudflare Pages project created
- [ ] Cloudflare Pages URL obtained
- [ ] `NEXT_PUBLIC_API_URL` set in Cloudflare Pages
- [ ] Cloudflare Pages URL documented
- [ ] Railway backend `CORS_ORIGIN` value noted (will update in code phase)
- [ ] Backend health endpoint accessible
- [ ] All URLs documented

---

## 🚀 **Next Steps (After Setup)**

Once infrastructure is configured:

1. **Update backend CORS** to support multiple origins (comma-separated)
2. **Add Cloudflare adapter** to frontend `package.json`
3. **Update build configuration** in `next.config.ts`
4. **Update build command** in Cloudflare Pages
5. **Test full deployment**
6. **Update CORS_ORIGIN** in Railway to include Cloudflare URL

**See `CLOUDFLARE_MIGRATION_CODE_CHANGES.md` for code changes (to be created).**

---

## 🔍 **Troubleshooting**

### Issue: Cloudflare build fails - "can't cd to frontend"
**Solution:** 
1. Go to Cloudflare Pages → Your Project → Settings → Builds & deployments
2. Set **Root directory** to `frontend` (not `/frontend`)
3. Update **Build command** to: `npm install && npm run build` (remove `cd frontend`)
4. Save and redeploy

**Root directory setting makes Cloudflare run commands from `frontend/` automatically.**

### Issue: "Output directory frontend/frontend/.next not found"
**Solution:**
1. Go to Cloudflare Pages → Your Project → Settings → Builds & deployments
2. Check **Build output directory** setting
3. It should be: `.next` (just `.next`, NOT `frontend/.next`)
4. When Root directory is `frontend`, output paths are relative to that directory
5. Save and redeploy

**The build succeeds, but Cloudflare can't find the output. Fix the output directory path.**

### Issue: CORS errors (Expected in Setup Phase)
**This is normal!** Backend currently only supports single origin. CORS will work after we update backend code to support multiple origins in the next phase.

**For now:** Just ensure Cloudflare Pages is deployed and environment variables are set.

### Issue: Environment variable not loading
**Check:**
1. Variable name is `NEXT_PUBLIC_API_URL` (exact)
2. Set in Cloudflare Pages → Settings → Environment Variables
3. Redeploy after adding variable

### Issue: Can't find CORS_ORIGIN in Railway
**Solution:** 
- Check backend service (not frontend)
- Look in Variables tab
- If missing, add it with value: `https://your-cloudflare-url.pages.dev`

---

## 📚 **Reference Links**

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Next.js on Cloudflare:** https://developers.cloudflare.com/pages/framework-guides/nextjs/
- **Railway CORS:** Check your backend `server.ts` or `app.ts` for CORS configuration

---

## ⚠️ **Important Notes**

1. **Don't delete Railway frontend yet** - Keep it running during migration
2. **Test thoroughly** - Use Cloudflare Pages URL for testing
3. **Backend stays on Railway** - Only frontend moves to Cloudflare
4. **Environment variables** - Must be set in Cloudflare dashboard
5. **CORS will be updated in code phase** - Backend code needs update to support multiple origins
6. **Keep Railway frontend running** - Don't delete it until Cloudflare is fully working

---

**Once this setup is complete, proceed to code changes phase.**
