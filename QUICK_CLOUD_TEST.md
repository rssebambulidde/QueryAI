# Quick Cloud Testing Guide
**Fast setup for testing in Railway/Vercel**

---

## ✅ **What's Already Done**

- ✅ Backend deployed on Railway
- ✅ Frontend code pushed to GitHub
- ✅ Backend CORS configured for Railway domains

---

## 🚀 **Deploy Frontend (Choose One)**

### **Option A: Railway (Same Platform)**

1. Railway Dashboard → Your Project → **"+ New"** → **"GitHub Repo"**
2. Select **QueryAI** repo
3. **Root Directory:** `frontend`
4. **Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```
5. Deploy! ✅

### **Option B: Vercel (Easier, Recommended)**

1. Go to: https://vercel.com
2. **"Add New Project"** → Import **QueryAI** repo
3. **Root Directory:** `frontend`
4. **Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```
5. Deploy! ✅

---

## 🔧 **Update Backend CORS (If Needed)**

If your frontend is on a different domain, add to Railway backend variables:

```
CORS_ORIGIN=https://your-frontend-domain.com
```

*(Backend already allows Railway domains automatically)*

---

## 🧪 **Test**

1. Open your frontend URL
2. Go to `/signup`
3. Create account
4. Should redirect to `/dashboard`
5. Test login/logout

---

## 📝 **Your URLs**

- **Backend:** `https://your-backend.railway.app`
- **Frontend:** `https://your-frontend.railway.app` or `https://your-app.vercel.app`

---

**That's it!** See `CLOUD_TESTING_GUIDE.md` for detailed instructions.
