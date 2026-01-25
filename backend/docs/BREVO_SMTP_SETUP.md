# Brevo SMTP Setup for Supabase
**Complete Guide to Configure Brevo (formerly Sendinblue) as Email Provider**

---

## 📧 **What is Brevo?**

Brevo (formerly Sendinblue) is an email marketing and transactional email service that provides:
- ✅ **Free tier:** 300 emails/day
- ✅ **Reliable SMTP** for transactional emails
- ✅ **Good deliverability** rates
- ✅ **Easy setup** and configuration
- ✅ **Perfect for production** use

---

## 🚀 **Step 1: Create Brevo Account**

### 1.1 Sign Up

1. Go to: https://www.brevo.com/
2. Click **"Sign up free"**
3. Fill in your details:
   - Email address
   - Password
   - Company name (optional)
4. Verify your email address
5. Complete the onboarding process

### 1.2 Verify Your Account

- Check your email for verification link
- Click to verify your account
- You'll be redirected to the Brevo dashboard

---

## 🔑 **Step 2: Get SMTP Credentials**

### 2.1 Access SMTP Settings

1. **Login to Brevo Dashboard:** https://app.brevo.com/
2. Navigate to: **Settings** → **SMTP & API** (in left sidebar)
3. Click on **"SMTP"** tab
4. You'll see your SMTP credentials

### 2.2 SMTP Credentials

Brevo provides these SMTP settings:

```
SMTP Server: smtp-relay.brevo.com
SMTP Port: 587 (TLS) or 465 (SSL)
SMTP Username: [Your Brevo login email]
SMTP Password: [Your SMTP Key - NOT your login password!]
```

**Important:** You need to generate an **SMTP Key**, not use your login password!

### 2.3 Generate SMTP Key

1. In **SMTP & API** settings, scroll to **"SMTP Keys"** section
2. Click **"Generate New Key"**
3. Give it a name: `QueryAI Production` (or similar)
4. Click **"Generate"**
5. **Copy the key immediately** - you won't be able to see it again!
6. Save it securely (this is your SMTP password)

**Example SMTP Key:**
```
xsmtpib-1234567890abcdefghijklmnopqrstuvwxyz
```

---

## ⚙️ **Step 3: Configure in Supabase**

### 3.1 Access SMTP Settings

1. Go to your **Supabase Dashboard**
2. Select your **QueryAI** project
3. Navigate to: **Project Settings** → **Auth** → **SMTP Settings**
4. Toggle **"Enable Custom SMTP"** to **ON**

### 3.2 Enter Brevo SMTP Credentials

Fill in the following fields:

| Field | Value |
|------|-------|
| **SMTP Host** | `smtp-relay.brevo.com` |
| **SMTP Port** | `587` (recommended) or `465` |
| **SMTP User** | `[Your Brevo login email]` |
| **SMTP Password** | `[Your SMTP Key from Step 2.3]` |
| **Sender Email** | `noreply@yourdomain.com` or your verified email |
| **Sender Name** | `QueryAI` |

### 3.3 Port Selection

**Port 587 (TLS) - Recommended:**
- ✅ More compatible
- ✅ Works with most email clients
- ✅ Better for transactional emails

**Port 465 (SSL):**
- ✅ More secure
- ⚠️ May have compatibility issues with some providers

**Recommendation:** Use **Port 587** for best compatibility.

### 3.4 Sender Email Configuration

**Option 1: Use Your Verified Email**
- Use the email you used to sign up for Brevo
- Example: `your-email@gmail.com`
- ✅ Works immediately

**Option 2: Use Custom Domain (Recommended for Production)**
- Add your domain in Brevo: **Settings** → **Senders & IP** → **Domains**
- Verify domain ownership (add DNS records)
- Use: `noreply@yourdomain.com`
- ✅ More professional
- ✅ Better deliverability

### 3.5 Save Configuration

1. Double-check all credentials
2. Click **"Save"**
3. Supabase will test the connection
4. If successful, you'll see a green checkmark ✅

---

## ✅ **Step 4: Verify Configuration**

### 4.1 Test Email Sending

1. In Supabase, go to: **Authentication** → **Email Templates**
2. Click on any template (e.g., "Reset Password")
3. Click **"Send Test Email"** button
4. Enter your email address
5. Click **"Send"**
6. Check your inbox (and spam folder)

### 4.2 Check Brevo Dashboard

1. Go to Brevo Dashboard
2. Navigate to: **Statistics** → **Email** → **Activity**
3. You should see the test email sent
4. Check delivery status

---

## 🔍 **Step 5: Troubleshooting**

### Issue 1: "Authentication Failed"

**Symptoms:**
- Error: "535 Authentication failed"
- Email not sending

**Solutions:**
1. ✅ Verify SMTP Key is correct (not login password)
2. ✅ Check SMTP Username is your Brevo email
3. ✅ Ensure SMTP Key hasn't been revoked
4. ✅ Try regenerating SMTP Key

### Issue 2: "Connection Timeout"

**Symptoms:**
- Error: "Connection timeout"
- Cannot connect to SMTP server

**Solutions:**
1. ✅ Check SMTP Host: `smtp-relay.brevo.com`
2. ✅ Try Port 587 instead of 465 (or vice versa)
3. ✅ Check firewall/network settings
4. ✅ Verify Brevo account is active

### Issue 3: "Sender Email Not Verified"

**Symptoms:**
- Error: "Sender email not verified"
- Emails rejected

**Solutions:**
1. ✅ Verify sender email in Brevo: **Settings** → **Senders & IP**
2. ✅ Use the email you signed up with
3. ✅ Or verify your custom domain
4. ✅ Wait for verification to complete (can take a few minutes)

### Issue 4: "Daily Limit Exceeded"

**Symptoms:**
- Error: "Daily sending limit reached"
- Emails not sending

**Solutions:**
1. ✅ Check Brevo dashboard for daily limit
2. ✅ Free tier: 300 emails/day
3. ✅ Upgrade plan if needed
4. ✅ Wait for limit reset (next day)

### Issue 5: Emails Going to Spam

**Solutions:**
1. ✅ Use verified custom domain
2. ✅ Set up SPF, DKIM, and DMARC records
3. ✅ Use professional sender name
4. ✅ Avoid spam trigger words in subject/content
5. ✅ Warm up your domain gradually

---

## 📊 **Step 6: Monitor Email Delivery**

### 6.1 Brevo Dashboard

1. Go to: **Statistics** → **Email** → **Activity**
2. View:
   - Sent emails
   - Delivered emails
   - Opened emails
   - Clicked emails
   - Bounced emails
   - Spam reports

### 6.2 Supabase Logs

1. Go to: **Logs** → **Auth Logs**
2. Check for email sending errors
3. Look for SMTP-related errors

### 6.3 Key Metrics to Monitor

- **Delivery Rate:** Should be >95%
- **Open Rate:** Varies by email type
- **Bounce Rate:** Should be <5%
- **Spam Rate:** Should be <0.1%

---

## 🔐 **Step 7: Security Best Practices**

### 7.1 Protect SMTP Key

- ✅ Never commit SMTP key to Git
- ✅ Store in environment variables
- ✅ Rotate keys periodically
- ✅ Use different keys for dev/prod

### 7.2 Domain Verification

- ✅ Verify your domain in Brevo
- ✅ Set up SPF record
- ✅ Set up DKIM record
- ✅ Set up DMARC record (optional but recommended)

### 7.3 Rate Limiting

- ✅ Monitor daily email limits
- ✅ Implement rate limiting in your app
- ✅ Use email queue for high volume

---

## 📝 **Step 8: DNS Records for Custom Domain**

If using a custom domain, add these DNS records:

### SPF Record
```
Type: TXT
Name: @ (or your domain)
Value: v=spf1 include:spf.brevo.com ~all
TTL: 3600
```

### DKIM Record
1. Go to Brevo: **Settings** → **Senders & IP** → **Domains**
2. Click on your domain
3. Copy the DKIM record provided
4. Add as TXT record in your DNS

### DMARC Record (Optional)
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
TTL: 3600
```

---

## 🎯 **Quick Reference**

### Brevo SMTP Settings Summary

```
SMTP Host: smtp-relay.brevo.com
SMTP Port: 587 (TLS) or 465 (SSL)
SMTP User: [Your Brevo email]
SMTP Password: [Your SMTP Key]
Sender Email: [Verified email or custom domain]
Sender Name: QueryAI
```

### Supabase Configuration Path

```
Project Settings → Auth → SMTP Settings
```

### Brevo Dashboard Links

- **SMTP Settings:** https://app.brevo.com/settings/smtp
- **Senders & IP:** https://app.brevo.com/settings/senders
- **Email Activity:** https://app.brevo.com/statistics/email/activity
- **API Keys:** https://app.brevo.com/settings/keys/api

---

## ✅ **Checklist**

- [ ] Created Brevo account
- [ ] Verified email address
- [ ] Generated SMTP Key
- [ ] Copied SMTP credentials
- [ ] Configured SMTP in Supabase
- [ ] Tested email sending
- [ ] Verified email delivery
- [ ] Set up custom domain (optional)
- [ ] Configured DNS records (if using custom domain)
- [ ] Monitored email metrics

---

## 💡 **Pro Tips**

1. **Free Tier Limits:**
   - 300 emails/day
   - Perfect for development and small production apps
   - Upgrade when you need more

2. **SMTP Key Security:**
   - Generate separate keys for dev/prod
   - Rotate keys every 90 days
   - Never share keys publicly

3. **Email Deliverability:**
   - Use custom domain for better deliverability
   - Set up SPF/DKIM records
   - Monitor bounce rates

4. **Testing:**
   - Always test with real email addresses
   - Check spam folder
   - Monitor Brevo dashboard for issues

5. **Scaling:**
   - Monitor daily limits
   - Upgrade plan before hitting limits
   - Consider email queue for high volume

---

## 📚 **Additional Resources**

- **Brevo Documentation:** https://help.brevo.com/
- **Brevo SMTP Guide:** https://help.brevo.com/hc/en-us/articles/209467485
- **Supabase SMTP Docs:** https://supabase.com/docs/guides/auth/auth-smtp
- **Email Deliverability Guide:** https://help.brevo.com/hc/en-us/articles/209467485

---

## 🆘 **Support**

**Brevo Support:**
- Email: support@brevo.com
- Help Center: https://help.brevo.com/
- Live Chat: Available in dashboard

**Supabase Support:**
- Documentation: https://supabase.com/docs
- Discord: https://discord.supabase.com
- GitHub: https://github.com/supabase/supabase

---

**Last Updated:** 2026-01-11  
**Brevo Version:** Current (as of 2026)
