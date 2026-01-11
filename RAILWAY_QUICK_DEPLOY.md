# Railway Frontend Deployment - Quick Guide
**5-Minute Setup**

---

## ⚡ **Quick Steps**

### **1. Create Service** (1 min)
- Railway Dashboard → Your Project → **"+ New"** → **"GitHub Repo"**
- Select **QueryAI** repository

### **2. Configure** (2 min)
- **Settings** → **Root Directory:** `frontend`
- **Variables** → Add:
  ```
  NEXT_PUBLIC_API_URL=https://your-backend.railway.app
  ```

### **3. Deploy** (2 min)
- Railway auto-deploys
- Wait for build to complete
- Get URL from **Settings** → **Domains**

### **4. Update CORS** (1 min)
- Backend service → **Variables**
- Add/Update:
  ```
  CORS_ORIGIN=https://your-frontend.railway.app
  ```

---

## ✅ **Done!**

Test at your frontend URL.

---

**See `RAILWAY_FRONTEND_DEPLOYMENT.md` for detailed guide.**
