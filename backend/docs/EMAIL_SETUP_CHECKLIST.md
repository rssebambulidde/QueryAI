# Email Setup Checklist
**Follow this checklist to configure Supabase email settings**

---

## ✅ **Step 1: Email Confirmation Settings**

### Location: `Authentication` → `Settings` → `Email Auth`

- [ ] Open Supabase Dashboard
- [ ] Navigate to: **Authentication** → **Settings**
- [ ] Find **"Enable Email Confirmations"** toggle
- [ ] **For Development:** Turn **OFF** (allows immediate signup)
- [ ] **For Production:** Turn **ON** (requires email verification)
- [ ] Click **"Save"**

**Current Setting:** ☐ ON  ☐ OFF

---

## ✅ **Step 2: Password Reset Email Template**

### Location: `Authentication` → `Email Templates` → `Reset Password`

- [ ] Navigate to: **Authentication** → **Email Templates**
- [ ] Click on **"Reset Password"** template
- [ ] Copy the template from `SUPABASE_EMAIL_SETUP.md` (or use default)
- [ ] Paste into the HTML editor
- [ ] Customize if needed (add your branding)
- [ ] Click **"Save"**

**Template Status:** ☐ Default  ☐ Customized

---

## ✅ **Step 3: Configure Redirect URLs**

### Location: `Authentication` → `URL Configuration`

- [ ] Navigate to: **Authentication** → **URL Configuration**
- [ ] Set **Site URL** to your Railway domain:
  ```
  https://your-app.railway.app
  ```
  *(Replace with your actual Railway domain)*

- [ ] Add **Redirect URLs** (one per line):
  ```
  https://your-app.railway.app
  https://your-app.railway.app/reset-password
  http://localhost:3000
  http://localhost:3000/reset-password
  ```

- [ ] Click **"Save"**

**Site URL:** `___________________________`  
**Redirect URLs Added:** ☐ Yes  ☐ No

---

## ✅ **Step 4: Verify Environment Variables**

### Check Railway Environment Variables

- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `API_BASE_URL` is set to your Railway domain
- [ ] All variables are correct

**API_BASE_URL:** `___________________________`

---

## ✅ **Step 5: Test Email Confirmation (if enabled)**

- [ ] Sign up a test user via API:
  ```bash
  POST /api/auth/signup
  {
    "email": "test@example.com",
    "password": "test123456"
  }
  ```
- [ ] Check email inbox (and spam folder)
- [ ] Click confirmation link in email
- [ ] Verify account is activated
- [ ] Try logging in

**Test Email:** `___________________________`  
**Confirmation Received:** ☐ Yes  ☐ No

---

## ✅ **Step 6: Test Password Reset**

- [ ] Request password reset via API:
  ```bash
  POST /api/auth/forgot-password
  {
    "email": "test@example.com"
  }
  ```
- [ ] Check email inbox (and spam folder)
- [ ] Verify reset email received
- [ ] Click reset link in email
- [ ] Verify redirect URL is correct

**Reset Email Received:** ☐ Yes  ☐ No  
**Reset Link Works:** ☐ Yes  ☐ No

---

## ✅ **Step 7: Configure SMTP (Production Only)**

### Location: `Project Settings` → `Auth` → `SMTP Settings`

- [ ] Navigate to: **Project Settings** → **Auth** → **SMTP Settings**
- [ ] Choose SMTP provider (SendGrid, Mailgun, etc.)
- [ ] Enter SMTP credentials:
  - Host: `___________________________`
  - Port: `___________________________`
  - User: `___________________________`
  - Password: `___________________________`
- [ ] Set sender email: `___________________________`
- [ ] Set sender name: `QueryAI`
- [ ] Click **"Save"**
- [ ] Test email sending

**SMTP Configured:** ☐ Yes  ☐ No (using Supabase default)

---

## 📝 **Notes**

**My Railway Domain:** `___________________________`  
**My Supabase Project:** `___________________________`  
**Email Provider:** ☐ Supabase Default  ☐ Custom SMTP

**Issues Encountered:**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## 🎯 **Completion Status**

- [ ] All steps completed
- [ ] Email confirmation tested
- [ ] Password reset tested
- [ ] Ready for production

**Completed Date:** `___________________________`

---

**Need Help?** See `SUPABASE_EMAIL_SETUP.md` for detailed instructions.
