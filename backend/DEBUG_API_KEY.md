# Debug Invalid API Key Issue
**Step-by-Step Troubleshooting Guide**

---

## 🔴 **Current Issue**

Logs show:
```
Invalid API key
AuthApiError: Invalid API key
```

This means Supabase environment variables are not being read correctly by the backend.

---

## 🧪 **Step 1: Verify Environment Variables in Railway**

1. **Go to Railway Dashboard**
2. **Select Backend Service**
3. **Go to Variables tab**
4. **Verify these exist:**

### **Check Each Variable:**

✅ **SUPABASE_URL:**
- Should be: `https://fargnfybpujfycgfmnco.supabase.co`
- Format: `https://[project-id].supabase.co`
- No trailing slash

✅ **SUPABASE_ANON_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Should be very long (200+ characters)
- No spaces, no line breaks

✅ **SUPABASE_SERVICE_ROLE_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Should be very long (200+ characters)
- **No spaces, no line breaks** ⚠️

---

## 🔍 **Step 2: Check for Common Issues**

### **Issue 1: Spaces in Keys**
- Keys must be one continuous string
- No spaces anywhere
- No line breaks

### **Issue 2: Wrong Key Copied**
- Make sure you copied from **Settings → API**
- **SUPABASE_ANON_KEY** = `anon` `public` key
- **SUPABASE_SERVICE_ROLE_KEY** = `service_role` `secret` key

### **Issue 3: Quotes Around Values**
- Railway should NOT have quotes around values
- If you see `"eyJhbG..."` remove the quotes
- Should be: `eyJhbG...` (no quotes)

### **Issue 4: Variables Not Saved**
- Click each variable to verify it's saved
- Make sure you clicked "Save" or "Add"

---

## 🧪 **Step 3: Use Debug Endpoint**

I've added a debug endpoint to check if variables are loaded:

**In Development Only:**
```
GET https://your-backend.railway.app/api/debug/env
```

This will show:
- Which variables are set
- Length of keys (to verify they're complete)
- First 30 characters of URL

**Note:** Only works if `NODE_ENV !== 'production'`

---

## 🔧 **Step 4: Manual Fix Steps**

### **Option A: Re-copy from Supabase**

1. **Go to Supabase Dashboard**
   - https://app.supabase.com
   - Select your project
   - **Settings → API**

2. **Copy SUPABASE_URL:**
   - Copy from **"Project URL"**
   - Should be: `https://fargnfybpujfycgfmnco.supabase.co`

3. **Copy SUPABASE_ANON_KEY:**
   - Copy from **"anon" `public`** section
   - Copy the ENTIRE key (starts with `eyJ...`)
   - No spaces, no line breaks

4. **Copy SUPABASE_SERVICE_ROLE_KEY:**
   - Copy from **"service_role" `secret`** section
   - **Click "Reveal" if hidden**
   - Copy the ENTIRE key (starts with `eyJ...`)
   - No spaces, no line breaks

5. **Update in Railway:**
   - Go to Railway → Backend → Variables
   - For each variable:
     - Click to edit
     - **Delete old value completely**
     - Paste new value
     - Save

### **Option B: Delete and Re-add**

1. In Railway Variables:
   - Delete all three Supabase variables
   - Re-add them one by one
   - Make sure to copy-paste directly from Supabase

---

## ✅ **Step 5: Redeploy**

After updating variables:

1. Railway will auto-redeploy
2. Or manually trigger: **Deployments → Redeploy**
3. Wait for deployment to complete
4. Try signup/login again

---

## 🧪 **Step 6: Test**

1. **Try signup:**
   - Should create user successfully
   - Should return tokens

2. **Check logs:**
   - Should NOT see "Invalid API key"
   - Should see successful signup/login

---

## 🔍 **If Still Not Working**

### **Check Railway Logs:**

1. Railway → Backend → Logs
2. Look for startup logs
3. Check if environment variables are mentioned

### **Verify Supabase Project:**

1. Make sure project is active
2. Check if API access is enabled
3. Verify project URL is correct

### **Test Keys Manually:**

You can test if keys work by making a direct API call (optional):

```bash
curl -X POST 'https://fargnfybpujfycgfmnco.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

---

## 📝 **Quick Checklist**

- [ ] SUPABASE_URL is set correctly
- [ ] SUPABASE_ANON_KEY has no spaces
- [ ] SUPABASE_SERVICE_ROLE_KEY has no spaces
- [ ] Keys are complete (200+ characters)
- [ ] No quotes around values in Railway
- [ ] Variables saved successfully
- [ ] Backend redeployed
- [ ] Tested signup/login

---

**Most Common Issue:** Space in SERVICE_ROLE_KEY. Make absolutely sure there are NO spaces!
