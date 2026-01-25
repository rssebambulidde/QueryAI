# Supabase API Keys Explained
**Which Keys Do You Need?**

---

## 🔑 **Two Types of Keys in Supabase**

Supabase now offers **two sets of keys**:

### **1. New Publishable Keys** (Latest)
- Format: `sb_publishable_...`
- **Purpose:** New recommended approach
- **Status:** Available but may require code changes

### **2. Legacy Keys** (What We're Using)
- `anon` `public` key → `SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose:** Traditional Supabase approach
- **Status:** ✅ Still supported and working

---

## ✅ **For QueryAI: Use Legacy Keys**

**Our current implementation uses:**
- ✅ `SUPABASE_ANON_KEY` = Legacy anon key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = Legacy service_role key

**You DON'T need the new publishable key right now!**

---

## 🔍 **How to Get Legacy Keys**

### **Step 1: Access Legacy Keys Tab**

1. **In Supabase Dashboard:**
   - Settings → **API Keys**
   - You'll see two tabs:
     - "Publishable and secret API keys" (new)
     - **"Legacy anon, service_role API keys"** ← **CLICK THIS**

2. **Click the "Legacy anon, service_role API keys" tab**

3. **You'll see:**
   - **anon** `public` key
   - **service_role** `secret` key

### **Step 2: Copy Legacy Keys**

**anon key:**
- Copy the **anon** `public` key
- This is your `SUPABASE_ANON_KEY`

**service_role key:**
- Click **"Reveal"** to show the service_role `secret` key
- Copy the **entire key**
- This is your `SUPABASE_SERVICE_ROLE_KEY`

---

## ✅ **Verify Keys in Railway**

Make sure Railway has the **legacy keys**, not the new publishable keys:

✅ **SUPABASE_ANON_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **NOT** `sb_publishable_...`

✅ **SUPABASE_SERVICE_ROLE_KEY:**
- Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **NOT** `sb_publishable_...`

---

## 🔍 **Check Current Keys**

### **If You See `sb_publishable_...`:**

❌ **WRONG KEY FORMAT!**

You're using the new publishable key, but our code expects legacy keys.

**Fix:**
1. Go to Supabase → Settings → API Keys
2. Click **"Legacy anon, service_role API keys"** tab
3. Copy the **anon** key (starts with `eyJ...`)
4. Copy the **service_role** key (starts with `eyJ...`)
5. Update in Railway

---

## 📝 **Quick Checklist**

- [ ] Using **Legacy** keys (not new publishable)
- [ ] ANON_KEY starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- [ ] SERVICE_ROLE_KEY starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- [ ] Both keys from same Supabase project
- [ ] Keys set in Railway backend variables

---

## ✅ **Answer: You DON'T Need New Publishable Key**

**Use Legacy Keys:**
- ✅ `anon` public key → `SUPABASE_ANON_KEY`
- ✅ `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

**These are the keys our code is configured to use!**

---

## 🔧 **Action Required**

1. **Verify you're using Legacy keys:**
   - Supabase → Settings → API Keys
   - Click **"Legacy anon, service_role API keys"** tab
   - Copy those keys (not the new publishable ones)

2. **Update Railway if needed:**
   - If Railway has `sb_publishable_...` keys
   - Replace with legacy `eyJ...` keys

3. **Test again:**
   - After updating keys
   - Railway will redeploy
   - Test signup/login

---

## 🎯 **Most Likely Issue**

**You might be using the NEW publishable keys instead of LEGACY keys!**

**Fix:** Switch to the "Legacy anon, service_role API keys" tab in Supabase and use those keys.

---

**After switching to legacy keys, authentication should work!**
