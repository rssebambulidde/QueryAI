# Fix: Signup Failing When Email Confirmation is Enabled
**Why signup fails and how to fix it**

---

## 🔴 **Problem**

When you enable email confirmation in Supabase:
- ✅ Signup request is sent
- ❌ Supabase tries to send confirmation email
- ❌ Email sending fails (SMTP not configured)
- ❌ Signup fails with error: "Error sending confirmation email"

---

## 🔍 **Root Cause**

**Email confirmations require SMTP to be configured!**

When email confirmations are enabled:
1. User signs up
2. Supabase creates the user account
3. Supabase tries to send confirmation email
4. **If SMTP is not configured → Email fails → Signup fails**

---

## ✅ **Solution: Configure SMTP (Recommended)**

You mentioned wanting to use **Brevo** for SMTP. Here's how to set it up:

### **Step 1: Get Brevo SMTP Credentials** (2 minutes)

1. **Go to Brevo Dashboard:**
   - https://app.brevo.com/
   - Login or create account

2. **Navigate to:** **Settings** → **SMTP & API** → **SMTP** tab

3. **Generate SMTP Key:**
   - Click **"Generate New Key"**
   - Name it: `QueryAI Production`
   - **Copy the SMTP Key** (you won't see it again!)

**Your Credentials:**
```
SMTP Host: smtp-relay.brevo.com
SMTP Port: 587
SMTP User: [Your Brevo email address]
SMTP Password: [The SMTP Key you just generated]
```

---

### **Step 2: Configure SMTP in Supabase** (2 minutes)

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. **Navigate to:** **Project Settings** → **Auth** → **SMTP Settings**

3. **Enable Custom SMTP:**
   - Toggle **"Enable Custom SMTP"** to **ON**

4. **Enter Brevo SMTP Details:**
   ```
   SMTP Host: smtp-relay.brevo.com
   SMTP Port: 587
   SMTP User: your-brevo-email@example.com
   SMTP Password: [Your SMTP Key]
   Sender Email: noreply@yourdomain.com (or your verified Brevo email)
   Sender Name: QueryAI
   ```

5. **Click "Save"**

6. **Wait for connection test** ✅

---

### **Step 3: Enable Email Confirmations** (1 minute)

1. **Go to:** **Authentication** → **Settings**

2. **Find:** **"Enable Email Confirmations"**

3. **Toggle:** **ON** ✅

4. **Click "Save"**

---

## 🧪 **Test After Configuration**

1. **Try signup:**
   ```bash
   POST /api/auth/signup
   {
     "email": "test@example.com",
     "password": "test123456"
   }
   ```

2. **Should return:**
   ```json
   {
     "success": true,
     "message": "User created successfully",
     "data": {
       "user": { ... },
       "session": {
         "accessToken": "",
         "refreshToken": "",
         "expiresIn": 0
       }
     }
   }
   ```
   *(Note: No session tokens because email confirmation is required)*

3. **Check email inbox** (and spam folder)

4. **Click confirmation link** in email

5. **Try login** - should work now! ✅

---

## 📝 **How It Works After Configuration**

### **With Email Confirmations Enabled:**

1. **User signs up** → Account created
2. **Confirmation email sent** via Brevo SMTP ✅
3. **User receives email** with confirmation link
4. **User clicks link** → Account activated
5. **User can now login** ✅

### **Signup Response:**

When email confirmation is required, the signup response will have:
- ✅ `user` object (user created)
- ⚠️ Empty `session` (no tokens until email confirmed)

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "accessToken": "",
    "refreshToken": "",
    "expiresIn": 0
  }
}
```

---

## 🔄 **Alternative: Disable Email Confirmations (Development Only)**

If you want to test without SMTP (NOT recommended for production):

1. **Go to:** **Authentication** → **Settings**
2. **Toggle:** **"Enable Email Confirmations"** → **OFF**
3. **Click "Save"**

**Note:** This allows immediate signup without email verification. **Only use for development/testing!**

---

## ✅ **Benefits of Email Confirmation**

- ✅ **Security:** Prevents fake accounts
- ✅ **Verification:** Ensures email addresses are valid
- ✅ **User Trust:** Users know their email is correct
- ✅ **Production Ready:** Required for production apps

---

## 🆘 **Troubleshooting**

### **"Authentication Failed" in Brevo?**
- ✅ Make sure you're using the **SMTP Key**, not your login password
- ✅ Regenerate the SMTP Key if needed

### **"Connection Timeout"?**
- ✅ Check SMTP Host: `smtp-relay.brevo.com`
- ✅ Try Port 587

### **"Sender Not Verified"?**
- ✅ Use the email you signed up with in Brevo
- ✅ Or verify your custom domain in Brevo

### **Emails Going to Spam?**
- ✅ Verify sender email in Brevo
- ✅ Use a custom domain (better deliverability)
- ✅ Configure SPF/DKIM records (advanced)

---

## 📚 **More Information**

- **Brevo Setup Guide:** `backend/docs/BREVO_SMTP_SETUP.md`
- **Quick Brevo Setup:** `backend/docs/BREVO_QUICK_SETUP.md`
- **Email Setup Checklist:** `backend/docs/EMAIL_SETUP_CHECKLIST.md`

---

## ✅ **Summary**

**The Issue:**
- Email confirmations enabled → Supabase tries to send email
- SMTP not configured → Email fails → Signup fails

**The Fix:**
- Configure Brevo SMTP in Supabase (5 minutes)
- Enable email confirmations
- Signup will work! ✅

**After SMTP is configured, email confirmations will work perfectly!** 🎉
