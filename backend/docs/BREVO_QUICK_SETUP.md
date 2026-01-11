# Brevo SMTP - Quick Setup Guide
**5-Minute Setup for Brevo Email in Supabase**

---

## ⚡ **Quick Steps**

### **1. Get Brevo SMTP Credentials** (2 minutes)

1. Go to: https://app.brevo.com/
2. Navigate: **Settings** → **SMTP & API** → **SMTP** tab
3. Click: **"Generate New Key"**
4. Name it: `QueryAI Production`
5. **Copy the SMTP Key** (you won't see it again!)

**Your Credentials:**
```
SMTP Host: smtp-relay.brevo.com
SMTP Port: 587
SMTP User: [Your Brevo email]
SMTP Password: [The SMTP Key you just generated]
```

---

### **2. Configure in Supabase** (2 minutes)

1. Go to: **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**
2. Toggle: **"Enable Custom SMTP"** → **ON**
3. Fill in:
   - **SMTP Host:** `smtp-relay.brevo.com`
   - **SMTP Port:** `587`
   - **SMTP User:** Your Brevo email
   - **SMTP Password:** Your SMTP Key
   - **Sender Email:** Your verified email (or custom domain)
   - **Sender Name:** `QueryAI`
4. Click: **"Save"**
5. Wait for connection test ✅

---

### **3. Test** (1 minute)

1. Go to: **Authentication** → **Email Templates**
2. Click: **"Reset Password"** template
3. Click: **"Send Test Email"**
4. Enter your email
5. Check inbox!

---

## ✅ **Done!**

Your emails are now sent via Brevo.

---

## 🔍 **Troubleshooting**

**"Authentication Failed"?**
- ✅ Make sure you're using the **SMTP Key**, not your login password
- ✅ Regenerate the SMTP Key if needed

**"Connection Timeout"?**
- ✅ Check SMTP Host: `smtp-relay.brevo.com`
- ✅ Try Port 587

**"Sender Not Verified"?**
- ✅ Use the email you signed up with
- ✅ Or verify your custom domain in Brevo

---

## 📚 **Need More Details?**

See `BREVO_SMTP_SETUP.md` for complete guide.

---

**Brevo Dashboard:** https://app.brevo.com/  
**Supabase SMTP Settings:** Project Settings → Auth → SMTP Settings
