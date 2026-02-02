# Supabase: Reset Password Email Template (Button Only)

Use this guide to set the **Reset Password** email in Supabase so users see **only a “Reset Password” button** (no copy-paste link).

---

## 1. Open the template in Supabase

1. Go to **[Supabase Dashboard](https://app.supabase.com)** and open your **QueryAI** project.
2. In the left sidebar: **Authentication** → **Email Templates**.
3. Click **Reset Password**.

---

## 2. Set subject and body

### Subject

```text
Reset Your QueryAI Password
```

### Message body (HTML) – button only, no link

Paste this into the **Message** (HTML) field. It uses **only** the button; the “copy this link” line is removed.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #ea580c;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #c2410c;
    }
    .footer {
      margin-top: 28px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="margin-top:0;">Reset Your Password</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your QueryAI account.</p>
    <p><strong>Click the button below to reset your password:</strong></p>
    <p>
      <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
    </p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request a password reset, you can ignore this email. If you have concerns, contact support.</p>
    <div class="footer">
      <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
```

**Important:** Supabase replaces `{{ .ConfirmationURL }}` with the real reset link. The button is the only way to reset; there is no “copy this link” line.

### Plain text (optional fallback)

If your SMTP or Supabase setup uses a plain-text fallback, use:

```text
Reset Your QueryAI Password

Hello,

We received a request to reset your password for your QueryAI account.

Click the link below to reset your password (this is the same as the button in the HTML version):

{{ .ConfirmationURL }}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support.

---
This is an automated message from QueryAI. Please do not reply to this email.
```

---

## 3. Redirect URL (required for “Reset Password” to work)

The link in the email must be allowed in Supabase:

1. Go to **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add your frontend reset page (one per environment), for example:
   - Production: `https://your-domain.com/reset-password`
   - Local: `http://localhost:3000/reset-password`
3. **Site URL** should match your main app (e.g. `https://your-domain.com` or `http://localhost:3000`).

If the redirect URL is missing, the reset link may be blocked or fail after the user clicks the button.

---

## 4. Test the flow

1. Use your app’s “Forgot password” and submit an email that receives the reset message.
2. Open the email and confirm:
   - You see **only the “Reset Password” button** (no extra link paragraph).
   - Clicking the button opens your app at `/reset-password` (with token in URL/hash).
3. Set a new password and submit; the request should succeed (your app now sends the token in the `Authorization` header).

---

## Quick checklist

- [ ] **Authentication** → **Email Templates** → **Reset Password** opened.
- [ ] Subject set to “Reset Your QueryAI Password” (or your choice).
- [ ] HTML body pasted (button only, `{{ .ConfirmationURL }}` in the button `href`).
- [ ] **Authentication** → **URL Configuration** → Redirect URLs include your `/reset-password` URL.
- [ ] Tested: request reset → receive email → click button → land on `/reset-password` → set password.

For full email/SMTP and other templates, see **SUPABASE_EMAIL_SETUP.md**.
