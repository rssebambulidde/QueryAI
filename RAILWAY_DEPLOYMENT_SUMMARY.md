# Railway Deployment Summary
**Everything You Need to Deploy Frontend to Railway**

---

## ✅ **What We're Doing**

Deploying the frontend as a **second Railway service** in the same project.

---

## 🚀 **Quick Deployment Steps**

### **1. Create Frontend Service**

1. Railway Dashboard → Your **QueryAI** project
2. **"+ New"** → **"GitHub Repo"**
3. Select **QueryAI** repository

### **2. Configure Service**

**Settings Tab:**
- **Root Directory:** `frontend`
- **Service Name:** `queryai-frontend` (optional)

**Variables Tab:**
- Add: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
  - Replace with your actual backend Railway URL

### **3. Deploy**

- Railway auto-deploys
- Wait 2-5 minutes
- Get URL from **Settings** → **Domains**

### **4. Update Backend CORS**

**Backend Service → Variables:**
- Add/Update: `CORS_ORIGIN=https://your-frontend.railway.app`
- Replace with your frontend Railway URL

---

## 📋 **Checklist**

- [ ] Frontend service created
- [ ] Root directory set to `frontend`
- [ ] `NEXT_PUBLIC_API_URL` environment variable added
- [ ] Deployment successful
- [ ] Frontend URL obtained
- [ ] Backend `CORS_ORIGIN` updated
- [ ] Frontend loads correctly
- [ ] Signup works
- [ ] Login works
- [ ] Dashboard accessible

---

## 🔗 **Finding Your URLs**

### **Backend URL:**
1. Go to backend service
2. **Settings** → **Domains**
3. Copy Railway domain (e.g., `queryai-production.up.railway.app`)

### **Frontend URL:**
1. Go to frontend service
2. **Settings** → **Domains**
3. Copy Railway domain (e.g., `queryai-frontend.up.railway.app`)

---

## 🧪 **Testing**

1. Open frontend URL
2. Test signup: `/signup`
3. Test login: `/login`
4. Test dashboard: `/dashboard`
5. Verify all work correctly

---

## 📚 **Documentation**

- **Detailed Guide:** `RAILWAY_FRONTEND_DEPLOYMENT.md`
- **Quick Reference:** `RAILWAY_QUICK_DEPLOY.md`

---

## ✅ **You're Ready!**

Follow the steps above and you'll have both services running on Railway in minutes!

---

**Last Updated:** 2026-01-11
