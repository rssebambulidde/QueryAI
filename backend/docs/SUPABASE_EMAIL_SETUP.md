# Supabase Email Configuration Guide
**For QueryAI Authentication Setup**

This guide will help you configure email confirmation and password reset email templates in your Supabase dashboard.

---

## 📧 **Part 1: Email Confirmation Settings**

### Step 1: Access Authentication Settings

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your **QueryAI** project
3. Navigate to: **Authentication** → **Settings** (in the left sidebar)

### Step 2: Configure Email Confirmation

In the **Email Auth** section, you'll see:

#### **Enable Email Confirmations**
- **For Development:** 
  - ✅ **RECOMMENDED:** Turn **OFF** email confirmations for testing
  - This allows immediate signup without email verification
  - Users can sign up and login immediately
  
- **For Production:**
  - ✅ **RECOMMENDED:** Turn **ON** email confirmations
  - Users must verify their email before they can login
  - More secure, prevents fake accounts

#### **Current Setting Location:**
```
Authentication → Settings → Email Auth → Enable Email Confirmations
```

#### **What This Means:**
- **OFF:** Users can sign up and login immediately (good for development)
- **ON:** Users receive confirmation email, must click link to activate account

---

## 🔐 **Part 2: Password Reset Email Templates**

### Step 1: Access Email Templates

1. In Supabase Dashboard, go to: **Authentication** → **Email Templates**
2. You'll see several template options:
   - **Confirm signup**
   - **Magic Link**
   - **Change Email Address**
   - **Reset Password** ← **This is what we need**

### Step 2: Configure Password Reset Template

Click on **"Reset Password"** template.

#### **Template Variables Available:**
- `{{ .ConfirmationURL }}` - The password reset link
- `{{ .Token }}` - The reset token (if needed)
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address

#### **Recommended Template:**

**Subject:**
```
Reset Your QueryAI Password
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      padding: 30px;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #0056b3;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset Your Password</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your QueryAI account.</p>
    <p>Click the button below to reset your password:</p>
    <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #007bff;">{{ .ConfirmationURL }}</p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
    <div class="footer">
      <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
      <p>&copy; 2026 QueryAI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Body (Plain Text - Fallback):**
```
Reset Your QueryAI Password

Hello,

We received a request to reset your password for your QueryAI account.

Click the link below to reset your password:
{{ .ConfirmationURL }}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

---
This is an automated message from QueryAI. Please do not reply to this email.
© 2026 QueryAI. All rights reserved.
```

---

## 🔗 **Part 3: Configure Redirect URLs**

### Step 1: Set Site URL

1. Go to: **Authentication** → **URL Configuration**
2. Set **Site URL** to your Railway domain:
   ```
   https://your-app.railway.app
   ```
   Or for local development:
   ```
   http://localhost:3000
   ```

### Step 2: Add Redirect URLs

In **Redirect URLs**, add:

**For Development:**
```
http://localhost:3000
http://localhost:3000/reset-password
http://localhost:3001
http://localhost:3001/reset-password
```

**For Production (Railway):**
```
https://your-app.railway.app
https://your-app.railway.app/reset-password
https://your-app.railway.app/api/auth/reset-password
```

**Important:** Replace `your-app.railway.app` with your actual Railway domain!

---

## ⚙️ **Part 4: Email Provider Configuration**

### Option 1: Use Supabase Default (Development)

- Supabase provides a default email service
- **Limitations:** 
  - 3 emails per hour per user
  - Emails may go to spam
  - Not suitable for production

### Option 2: Custom SMTP (Production Recommended)

1. Go to: **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider:

**Popular Options:**
- **SendGrid** (Recommended)
- **Mailgun**
- **AWS SES**
- **Postmark**
- **Resend**

**Example: Brevo Configuration:**
```
SMTP Host: smtp-relay.brevo.com
SMTP Port: 587
SMTP User: [Your Brevo login email]
SMTP Password: [Your Brevo SMTP Key]
Sender Email: noreply@yourdomain.com
Sender Name: QueryAI
```

**Example: SendGrid Configuration:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@yourdomain.com
Sender Name: QueryAI
```

**📖 For detailed Brevo setup instructions, see:** `BREVO_SMTP_SETUP.md`

---

## ✅ **Part 5: Testing Your Configuration**

### Test Email Confirmation (if enabled):

1. **Sign up a test user:**
   ```bash
   POST /api/auth/signup
   {
     "email": "test@example.com",
     "password": "testpassword123",
     "fullName": "Test User"
   }
   ```

2. **Check email inbox** for confirmation email
3. **Click confirmation link** to activate account
4. **Try logging in** with the credentials

### Test Password Reset:

1. **Request password reset:**
   ```bash
   POST /api/auth/forgot-password
   {
     "email": "test@example.com"
   }
   ```

2. **Check email inbox** for reset email
3. **Click reset link** in email
4. **Should redirect to:** `https://your-app.railway.app/reset-password?token=...`
5. **Set new password** (you'll need to implement the reset password page)

---

## 🔍 **Part 6: Troubleshooting**

### Emails Not Sending?

1. **Check Supabase Logs:**
   - Go to: **Logs** → **Auth Logs**
   - Look for email sending errors

2. **Check Email Provider:**
   - Verify SMTP credentials are correct
   - Check if provider has rate limits
   - Verify sender email is verified

3. **Check Spam Folder:**
   - Emails might be going to spam
   - Add `noreply@yourdomain.com` to contacts

### Reset Link Not Working?

1. **Check Redirect URLs:**
   - Ensure your Railway domain is in the allowed list
   - Check that the redirect URL matches exactly

2. **Check Token Expiry:**
   - Default is 1 hour
   - Can be changed in: **Authentication** → **Settings** → **Password Reset**

3. **Check API Configuration:**
   - Verify `API_BASE_URL` in Railway environment variables
   - Should match your Railway public domain

---

## 📝 **Part 7: Environment Variables Check**

Make sure these are set in Railway:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_BASE_URL=https://your-app.railway.app
```

---

## 🎯 **Quick Checklist**

- [ ] Email confirmations configured (ON for production, OFF for dev)
- [ ] Password reset email template customized
- [ ] Site URL set to Railway domain
- [ ] Redirect URLs added (including `/reset-password`)
- [ ] SMTP configured (for production)
- [ ] Tested email confirmation (if enabled)
- [ ] Tested password reset flow
- [ ] Environment variables set in Railway

---

## 📚 **Additional Resources**

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)

---

## 💡 **Pro Tips**

1. **Development:** Keep email confirmations OFF for faster testing
2. **Production:** Always enable email confirmations for security
3. **Custom Domain:** Use a custom domain for emails (e.g., `noreply@queryai.com`)
4. **Email Design:** Keep templates simple and professional
5. **Testing:** Always test email flows before deploying to production
6. **Monitoring:** Set up email delivery monitoring to catch issues early

---

**Last Updated:** 2026-01-11
