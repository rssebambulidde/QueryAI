# Quick Answer: Which Keys Do You Need?
**Legacy Keys, NOT New Publishable Keys**

---

## ✅ **ANSWER: You DON'T Need New Publishable Key**

**Use Legacy Keys:**

1. **In Supabase Dashboard:**
   - Settings → **API Keys**
   - You'll see two tabs:
     - "Publishable and secret API keys" ← **Skip this**
     - **"Legacy anon, service_role API keys"** ← **USE THIS**

2. **Click "Legacy anon, service_role API keys" tab**

3. **Copy these keys:**
   - **anon** `public` key → `SUPABASE_ANON_KEY`
   - **service_role** `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🔑 **Key Format Check**

### **✅ Correct (Legacy Keys):**
- Starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- This is what our code uses!

### **❌ Wrong (New Publishable Keys):**
- Starts with: `sb_publishable_...`
- **Don't use these** - our code doesn't support them yet

---

## 🔧 **If You're Using New Keys:**

1. **Switch to Legacy tab** in Supabase
2. **Copy legacy keys** (anon and service_role)
3. **Update in Railway:**
   - Replace `SUPABASE_ANON_KEY` with legacy anon key
   - Replace `SUPABASE_SERVICE_ROLE_KEY` with legacy service_role key
4. **Save and redeploy**

---

## ✅ **Summary**

- **New Publishable Key:** Not needed (skip it)
- **Legacy Keys:** ✅ Use these (anon + service_role)
- **Location:** Supabase → Settings → API Keys → **Legacy tab**

**After switching to legacy keys, authentication should work!**
