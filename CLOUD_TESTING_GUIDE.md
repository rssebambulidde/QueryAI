# Cloud Testing Guide - Railway
**Testing Frontend and Backend in Development Cloud**

---

## 🚀 **Current Status**

✅ **Backend:** Already deployed on Railway  
✅ **Frontend:** Just pushed to GitHub  
⏳ **Next:** Deploy frontend to Railway or Vercel

---

## 📋 **Option 1: Deploy Frontend to Vercel (Recommended)**

**Why Vercel?**
- ✅ Optimized for Next.js
- ✅ Global CDN automatically
- ✅ Free tier is generous
- ✅ Zero-config deployment
- ✅ Industry standard for Next.js

**Why NOT same Railway service?**
- ❌ Different build processes
- ❌ Can't scale independently
- ❌ Coupled deployments
- ❌ Less efficient

See `DEPLOYMENT_ARCHITECTURE.md` for detailed explanation.

---

## 📋 **Option 2: Deploy Frontend to Railway (Alternative)**

### Step 1: Create New Railway Service for Frontend

1. Go to your Railway dashboard: https://railway.app
2. Click on your **QueryAI** project
3. Click **"+ New"** → **"GitHub Repo"**
4. Select your **QueryAI** repository
5. Railway will detect it's a Next.js app

### Step 2: Configure Railway Service

1. **Set Root Directory:**
   - In Railway service settings
   - Set **Root Directory** to: `frontend`

2. **Configure Build Settings:**
   - Railway should auto-detect Next.js
   - Build command: `npm run build`
   - Start command: `npm start`

3. **Add Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-app.railway.app
   ```
   *(Replace with your actual backend Railway domain)*

### Step 3: Deploy

1. Railway will automatically build and deploy
2. Wait for deployment to complete
3. Get your frontend URL from Railway

### Step 4: Test

1. Open your frontend URL
2. Test signup/login
3. Verify API calls work

---

## 📋 **Option 2: Deploy Frontend to Vercel (Easier)**

### Step 1: Connect to Vercel

1. Go to: https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your **QueryAI** repository

### Step 2: Configure Project

1. **Root Directory:** Set to `frontend`
2. **Framework Preset:** Next.js (auto-detected)
3. **Build Command:** `npm run build` (default)
4. **Output Directory:** `.next` (default)

### Step 3: Add Environment Variables

In Vercel project settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend-app.railway.app
```

*(Replace with your actual backend Railway domain)*

### Step 4: Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy automatically
3. Get your frontend URL from Vercel

### Step 5: Test

1. Open your Vercel URL
2. Test all authentication flows
3. Verify everything works

---

## 🔗 **Update Backend CORS for Frontend**

### Step 1: Get Frontend URL

- Railway frontend URL: `https://your-frontend.railway.app`
- OR Vercel frontend URL: `https://your-app.vercel.app`

### Step 2: Update Backend CORS

In Railway backend service → Environment Variables:

Add or update:
```
CORS_ORIGIN=https://your-frontend.railway.app
```

Or if using Vercel:
```
CORS_ORIGIN=https://your-app.vercel.app
```

### Step 3: Redeploy Backend

Railway will automatically redeploy with new CORS settings.

---

## 🧪 **Testing Checklist**

### Backend Testing (Already Working)

- [x] Backend deployed on Railway
- [x] API endpoints accessible
- [x] Health check working
- [ ] CORS updated for frontend domain

### Frontend Testing (After Deployment)

- [ ] Frontend deployed (Railway or Vercel)
- [ ] Home page loads
- [ ] Signup page works
- [ ] Login page works
- [ ] Dashboard accessible after login
- [ ] Logout works
- [ ] Password reset works
- [ ] API calls succeed
- [ ] No CORS errors

---

## 🔧 **Troubleshooting**

### CORS Errors

**Problem:** Frontend can't call backend API

**Solution:**
1. Check `CORS_ORIGIN` in backend Railway variables
2. Add frontend domain to allowed origins
3. Redeploy backend

### API Connection Errors

**Problem:** Frontend can't reach backend

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` in frontend environment variables
2. Check backend is running and accessible
3. Test backend URL directly in browser

### Authentication Not Working

**Problem:** Login/signup fails

**Solution:**
1. Check browser console for errors
2. Verify API URL is correct
3. Check backend logs in Railway
4. Verify Supabase credentials in backend

---

## 📝 **Environment Variables Summary**

### Backend (Railway)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGIN=https://your-frontend-domain.com
API_BASE_URL=https://your-backend.railway.app
```

### Frontend (Railway or Vercel)

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## 🎯 **Quick Test Steps**

1. **Deploy Frontend** (Railway or Vercel)
2. **Update Backend CORS** with frontend URL
3. **Test Signup:**
   - Go to frontend URL
   - Click "Get Started" or go to `/signup`
   - Create account
   - Should redirect to dashboard

4. **Test Login:**
   - Logout
   - Go to `/login`
   - Sign in
   - Should redirect to dashboard

5. **Test Dashboard:**
   - View user information
   - Test logout

---

## 🔗 **Useful Links**

- **Railway Dashboard:** https://railway.app
- **Vercel Dashboard:** https://vercel.com
- **GitHub Repository:** https://github.com/rssebambulidde/QueryAI

---

## ✅ **Next Steps After Testing**

1. ✅ Verify all authentication flows work
2. ⏳ Add chat interface
3. ⏳ Add document upload
4. ⏳ Add AI query interface
5. ⏳ Continue with Phase 1.4: Basic AI Integration

---

**Last Updated:** 2026-01-11
