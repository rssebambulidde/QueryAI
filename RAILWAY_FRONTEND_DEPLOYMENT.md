# Deploy Frontend to Railway
**Step-by-Step Guide for Deploying Next.js Frontend to Railway**

---

## 🚀 **Quick Setup (5 Minutes)**

### **Step 1: Create New Railway Service**

1. Go to your **Railway Dashboard**: https://railway.app
2. Click on your **QueryAI** project
3. Click **"+ New"** button (top right)
4. Select **"GitHub Repo"**
5. Select your **QueryAI** repository
6. Railway will start detecting the project

---

### **Step 2: Configure Service Settings**

1. **Click on the new service** (it will have a random name)
2. Go to **Settings** tab
3. **Rename the service** (optional but recommended):
   - Click on service name
   - Change to: `queryai-frontend` or `frontend`

4. **Set Root Directory:**
   - Scroll to **"Root Directory"** section
   - Enter: `frontend`
   - Click **"Save"**

---

### **Step 3: Configure Build Settings**

Railway should auto-detect Next.js, but verify:

1. Go to **Settings** → **Deploy**
2. **Build Command:** Should be `npm run build` (default)
3. **Start Command:** Should be `npm start` (default)
4. If not set, add:
   ```
   Build Command: npm run build
   Start Command: npm start
   ```

---

### **Step 4: Add Environment Variables**

1. Go to **Variables** tab
2. Click **"+ New Variable"**
3. Add:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://your-backend-service.railway.app
   ```
   
   **Important:** Replace `your-backend-service.railway.app` with your actual backend Railway URL.
   
   To find your backend URL:
   - Go to your backend service in Railway
   - Click on the service
   - Look at the **"Domains"** section
   - Copy the Railway-provided domain (e.g., `queryai-production.up.railway.app`)

4. Click **"Add"**

---

### **Step 5: Deploy**

1. Railway will automatically start building
2. Watch the **Deployments** tab for progress
3. Wait 2-5 minutes for build to complete
4. Once deployed, Railway will provide a URL

---

### **Step 6: Get Frontend URL**

1. After deployment completes
2. Go to **Settings** → **Domains**
3. Railway provides a domain like: `queryai-frontend.up.railway.app`
4. Copy this URL

---

### **Step 7: Update Backend CORS**

1. Go to your **backend service** in Railway
2. Go to **Variables** tab
3. Find or add `CORS_ORIGIN` variable
4. Set value to your frontend URL:
   ```
   CORS_ORIGIN=https://queryai-frontend.up.railway.app
   ```
   (Replace with your actual frontend URL)

5. Railway will automatically redeploy backend with new CORS settings

---

## 🧪 **Testing**

### **Test Frontend**

1. Open your frontend Railway URL
2. Should see the home page
3. Click **"Get Started"** or go to `/signup`
4. Create a test account
5. Should redirect to dashboard

### **Test Authentication Flow**

1. **Signup:**
   - Go to `/signup`
   - Fill in form
   - Should create account and redirect

2. **Login:**
   - Go to `/login`
   - Sign in with credentials
   - Should redirect to dashboard

3. **Dashboard:**
   - Should show user information
   - Test logout button

---

## 🔧 **Troubleshooting**

### **Build Fails**

**Problem:** Build command fails

**Solution:**
1. Check **Deployments** tab for error logs
2. Verify `package.json` has build script
3. Check Root Directory is set to `frontend`
4. Ensure all dependencies are in `package.json`

### **Frontend Can't Connect to Backend**

**Problem:** API calls fail

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Check backend URL is accessible
3. Verify CORS is updated in backend
4. Check browser console for errors

### **CORS Errors**

**Problem:** Browser shows CORS errors

**Solution:**
1. Update `CORS_ORIGIN` in backend with frontend URL
2. Wait for backend redeploy
3. Clear browser cache
4. Try again

### **Page Not Found (404)**

**Problem:** Routes return 404

**Solution:**
1. Verify Next.js is building correctly
2. Check `next.config.ts` settings
3. Ensure `output: 'standalone'` is not set (for Railway)
4. Check deployment logs

---

## 📝 **Environment Variables Summary**

### **Frontend Service:**
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### **Backend Service:**
```
CORS_ORIGIN=https://your-frontend.railway.app
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 🎯 **Quick Checklist**

- [ ] Created new Railway service
- [ ] Set Root Directory to `frontend`
- [ ] Added `NEXT_PUBLIC_API_URL` environment variable
- [ ] Deployment completed successfully
- [ ] Got frontend URL from Railway
- [ ] Updated backend `CORS_ORIGIN` with frontend URL
- [ ] Tested frontend loads
- [ ] Tested signup works
- [ ] Tested login works
- [ ] Tested dashboard works

---

## 📊 **Service Structure in Railway**

```
QueryAI Project
├── Backend Service
│   ├── Root: backend
│   ├── Port: 3001 (or auto)
│   └── URL: backend.railway.app
│
└── Frontend Service
    ├── Root: frontend
    ├── Port: 3000 (or auto)
    └── URL: frontend.railway.app
```

---

## 💡 **Pro Tips**

1. **Custom Domains:**
   - You can add custom domains in Railway Settings
   - Both services can have custom domains

2. **Environment Variables:**
   - Use Railway's variable management
   - Can reference other services if needed

3. **Monitoring:**
   - Check **Metrics** tab for usage
   - Monitor **Logs** for errors

4. **Redeploy:**
   - Changes to code auto-deploy
   - Can manually redeploy from Deployments tab

---

## ✅ **Success Indicators**

You'll know it's working when:
- ✅ Frontend URL loads home page
- ✅ Signup creates account successfully
- ✅ Login works and redirects to dashboard
- ✅ Dashboard shows user information
- ✅ No CORS errors in browser console
- ✅ API calls succeed

---

## 🚀 **Next Steps**

After successful deployment:
1. ✅ Test all authentication flows
2. ⏳ Add custom domain (optional)
3. ⏳ Continue with Phase 1.4: AI Integration
4. ⏳ Add chat interface
5. ⏳ Add document upload

---

**Last Updated:** 2026-01-11  
**Status:** Ready to deploy ✅
