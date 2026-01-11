# Fix: Password Reset Email Not Delivering
**Quick Guide to Fix Password Reset Emails**

---

## 🔴 **Problem**

Password reset emails are not being delivered because:
- ❌ **SMTP is not configured** in Supabase
- ❌ Supabase's default email service has limits or may not be enabled
- ❌ Email sending requires SMTP configuration

---

## ✅ **Solution Options**

### **Option 1: Configure Brevo SMTP (Recommended for Production)**

You mentioned wanting to use Brevo. Follow this quick setup:

#### **Step 1: Get Brevo SMTP Credentials**

1. **Sign up/Login to Brevo:**
   - Go to: https://www.brevo.com/
   - Create account or login

2. **Get SMTP Credentials:**
   - Go to: **Settings** → **SMTP & API**
   - Click **"SMTP"** tab
   - Click **"Generate a new SMTP key"**
   - Copy these details:
     - **SMTP Server:** `smtp-relay.brevo.com`
     - **Port:** `587` (TLS) or `465` (SSL)
     - **Login:** (your Brevo email address)
     - **Password:** (the SMTP key you generated)

#### **Step 2: Configure in Supabase**

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. **Navigate to SMTP Settings:**
   - Go to: **Project Settings** → **Auth** → **SMTP Settings**
   - Or: **Authentication** → **Providers** → **Email** → **SMTP Settings**

3. **Enable Custom SMTP:**
   - Toggle **"Enable Custom SMTP"** to **ON**

4. **Enter Brevo SMTP Details:**
   ```
   SMTP Host: smtp-relay.brevo.com
   SMTP Port: 587
   SMTP User: your-brevo-email@example.com
   SMTP Password: your-smtp-key-here
   Sender Email: noreply@yourdomain.com (or your verified Brevo email)
   Sender Name: QueryAI
   ```

5. **Click "Save"**

6. **Test:**
   - Try password reset again
   - Check email inbox (and spam folder)

---

### **Option 2: Use Supabase Default (Limited)**

Supabase has a default email service, but:
- ⚠️ **Limited** emails per day
- ⚠️ **May not work** in all projects
- ⚠️ **Not recommended** for production

**To enable:**
1. Go to: **Authentication** → **Settings**
2. Make sure **"Enable Email Confirmations"** is configured
3. Test - may work or may fail (unreliable)

---

## 🔧 **Additional Configuration Needed**

### **1. Redirect URLs**

Make sure your reset password redirect URL is configured:

1. **Go to:** **Authentication** → **URL Configuration**
2. **Set Site URL:**
   ```
   https://your-frontend.railway.app
   ```
3. **Add Redirect URLs:**
   ```
   https://your-frontend.railway.app
   https://your-frontend.railway.app/reset-password
   http://localhost:3000/reset-password (for local dev)
   ```

### **2. Email Template**

1. **Go to:** **Authentication** → **Email Templates**
2. **Click:** **"Reset Password"**
3. **Use this template:**

```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>This link will expire in 1 hour.</p>
```

4. **Click "Save"**

---

## 🧪 **Test Password Reset**

After configuring SMTP:

1. **Request password reset:**
   ```bash
   POST /api/auth/forgot-password
   {
     "email": "your-email@example.com"
   }
   ```

2. **Check email inbox** (and spam folder)

3. **Click reset link** in email

4. **Should redirect** to your frontend `/reset-password` page

---

## 📝 **Check Backend Logs**

After requesting password reset, check Railway logs:

- ✅ **If successful:** `Password reset email sent successfully for: email@example.com`
- ❌ **If failed:** `Password reset request error: Error sending confirmation email`

---

## ✅ **Quick Checklist**

- [ ] Brevo account created
- [ ] Brevo SMTP key generated
- [ ] SMTP configured in Supabase
- [ ] Redirect URLs configured
- [ ] Email template updated
- [ ] Test password reset
- [ ] Email received in inbox

---

## 🆘 **Still Not Working?**

1. **Check Supabase Logs:**
   - Go to: **Logs** → **Postgres Logs** or **Auth Logs**
   - Look for email-related errors

2. **Verify SMTP Credentials:**
   - Test SMTP connection in Brevo dashboard
   - Make sure SMTP key is correct

3. **Check Email Spam Folder:**
   - Emails might be going to spam

4. **Verify Redirect URL:**
   - Make sure `API_BASE_URL` in Railway is set correctly
   - Should be your backend URL: `https://your-backend.railway.app`

5. **Check Brevo Sender Verification:**
   - Verify sender email in Brevo
   - Some providers require sender verification

---

## 📚 **More Info**

- **Brevo Setup Guide:** `backend/docs/BREVO_SMTP_SETUP.md`
- **Quick Brevo Setup:** `backend/docs/BREVO_QUICK_SETUP.md`
- **Email Setup Checklist:** `backend/docs/EMAIL_SETUP_CHECKLIST.md`

---

**After configuring SMTP, password reset emails should work!** ✅
