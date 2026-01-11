# Supabase Email Setup - Quick Reference
**Step-by-Step Visual Guide**

---

## 🚀 **Quick Setup (5 Minutes)**

### **Step 1: Email Confirmation Settings**

1. **Navigate to:** `Authentication` → `Settings`
2. **Find:** `Enable Email Confirmations` toggle
3. **For Development:** Turn **OFF** ⬇️
4. **For Production:** Turn **ON** ⬆️
5. **Click:** `Save`

---

### **Step 2: Password Reset Email Template**

1. **Navigate to:** `Authentication` → `Email Templates`
2. **Click:** `Reset Password` template
3. **Copy the template** from `SUPABASE_EMAIL_SETUP.md`
4. **Paste** into the HTML editor
5. **Click:** `Save`

---

### **Step 3: Redirect URLs**

1. **Navigate to:** `Authentication` → `URL Configuration`
2. **Set Site URL:**
   ```
   https://your-app.railway.app
   ```
3. **Add Redirect URLs:**
   ```
   https://your-app.railway.app
   https://your-app.railway.app/reset-password
   ```
4. **Click:** `Save`

---

### **Step 4: Test**

1. **Test Signup:**
   ```bash
   curl -X POST https://your-app.railway.app/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123456"}'
   ```

2. **Test Password Reset:**
   ```bash
   curl -X POST https://your-app.railway.app/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

3. **Check email inbox** for the email

---

## 📍 **Navigation Paths**

| Task | Path in Supabase Dashboard |
|------|---------------------------|
| Email Confirmations | `Authentication` → `Settings` → `Email Auth` |
| Email Templates | `Authentication` → `Email Templates` |
| Redirect URLs | `Authentication` → `URL Configuration` |
| SMTP Settings | `Project Settings` → `Auth` → `SMTP Settings` |
| Auth Logs | `Logs` → `Auth Logs` |

---

## ⚠️ **Common Issues**

### **Issue:** Emails going to spam
**Solution:** Configure custom SMTP with verified domain

### **Issue:** Reset link not working
**Solution:** Add Railway domain to Redirect URLs

### **Issue:** Email confirmations blocking signup
**Solution:** Turn OFF for development, check spam folder

---

**Need more details?** See `SUPABASE_EMAIL_SETUP.md` for complete guide.
