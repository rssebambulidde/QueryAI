# Fix "Invalid API Key" Issue - Action Required
**Critical: Supabase Environment Variables Not Loading**

---

## 🔴 **Main Issue**

Logs show: `Invalid API key` - This means Supabase keys aren't being read correctly.

---

## ✅ **Fixes Applied**

1. ✅ **Trust proxy fixed** - Configured properly for Railway
2. ✅ **Rate limiter warning fixed** - Disabled validation warnings
3. ⏳ **API Key issue** - **NEEDS YOUR ACTION** (see below)

---

## 🔧 **Action Required: Fix Supabase Keys**

### **Step 1: Verify Keys in Railway**

1. Go to **Railway Dashboard**
2. Select **Backend Service**
3. Go to **Variables** tab
4. Check these 3 variables:

**SUPABASE_URL:**
- Should be: `https://fargnfybpujfycgfmnco.supabase.co`
- No trailing slash

**SUPABASE_ANON_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Should be 200+ characters long
- **NO SPACES, NO LINE BREAKS**

**SUPABASE_SERVICE_ROLE_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Should be 200+ characters long
- **NO SPACES, NO LINE BREAKS** ⚠️ **CRITICAL**

---

### **Step 2: Re-copy Keys from Supabase**

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. **Go to Settings → API**

3. **Copy SUPABASE_URL:**
   - Copy from **"Project URL"**
   - Should be: `https://fargnfybpujfycgfmnco.supabase.co`

4. **Copy SUPABASE_ANON_KEY:**
   - Copy from **"anon" `public`** section
   - Copy **ENTIRE key** (starts with `eyJ...`)
   - **Make sure NO spaces or line breaks**

5. **Copy SUPABASE_SERVICE_ROLE_KEY:**
   - Go to **"service_role" `secret`** section
   - Click **"Reveal"** if hidden
   - Copy **ENTIRE key** (starts with `eyJ...`)
   - **Make absolutely sure NO spaces anywhere** ⚠️

---

### **Step 3: Update in Railway**

1. **For each variable in Railway:**
   - Click to **edit**
   - **Delete the entire old value**
   - **Paste the new value** (directly from Supabase)
   - **Make sure no extra spaces**
   - Click **Save**

2. **Important Checks:**
   - ✅ No spaces in keys
   - ✅ No quotes around values
   - ✅ Keys are complete (200+ characters)
   - ✅ Values saved successfully

---

### **Step 4: Redeploy**

1. Railway will **auto-redeploy** after variable changes
2. Or manually trigger: **Deployments → Redeploy**
3. Wait for deployment to complete

---

## 🧪 **Test After Fix**

1. **Try signup:**
   - Go to frontend → `/signup`
   - Create account
   - Should work now!

2. **Check logs:**
   - Should NOT see "Invalid API key"
   - Should see successful signup

---

## 🔍 **Most Common Issues**

### **Issue 1: Space in SERVICE_ROLE_KEY**
- **Problem:** There's a space somewhere in the key
- **Fix:** Copy key again from Supabase, make sure no spaces
- **Check:** Look for space between `InNlcnZpY2Vfcm9sZSI` and `sImlhdCI`

### **Issue 2: Incomplete Key**
- **Problem:** Key was cut off during copy
- **Fix:** Copy entire key (should be 200+ characters)
- **Check:** Verify key length in Railway

### **Issue 3: Wrong Key**
- **Problem:** Copied wrong key type
- **Fix:** Make sure you're copying from correct section:
  - `SUPABASE_ANON_KEY` = **"anon" `public`** key
  - `SUPABASE_SERVICE_ROLE_KEY` = **"service_role" `secret`** key

### **Issue 4: Quotes Around Value**
- **Problem:** Value has quotes in Railway
- **Fix:** Remove quotes - value should be: `eyJhbG...` not `"eyJhbG..."`

---

## 📝 **Quick Checklist**

- [ ] SUPABASE_URL set correctly
- [ ] SUPABASE_ANON_KEY has NO spaces
- [ ] SUPABASE_SERVICE_ROLE_KEY has NO spaces (check carefully!)
- [ ] Keys are complete (200+ characters each)
- [ ] No quotes around values
- [ ] Variables saved in Railway
- [ ] Backend redeployed
- [ ] Tested signup - should work!

---

## ✅ **After Fix**

Once keys are correct:
- ✅ Trust proxy warning will be gone
- ✅ Rate limiter will work
- ✅ Signup will create users
- ✅ Login will work
- ✅ Authentication fully functional

---

**The main issue is likely a space in SERVICE_ROLE_KEY. Double-check and remove any spaces!**
