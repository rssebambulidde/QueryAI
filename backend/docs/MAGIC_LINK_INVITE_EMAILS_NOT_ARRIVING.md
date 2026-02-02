# Magic Link & Invite Emails Not Arriving

If **magic link** (passwordless login) or **invite** emails are not reaching the inbox, work through this checklist.

---

## 1. Backend: Frontend URL (Railway / env)

The link inside the email is built from your **frontend URL**. If it’s wrong or missing, the email can still be sent but the link may be broken, or Supabase may not send.

**Set one of these in Railway (backend service) → Variables:**

| Variable       | Example (production)                    |
|----------------|-----------------------------------------|
| `CORS_ORIGIN`  | `https://your-frontend-domain.com`      |
| or `API_BASE_URL` | `https://your-frontend-domain.com`  |

- **No trailing slash.** Example: `https://queryai.vercel.app` not `https://queryai.vercel.app/`.
- If both are unset or wrong, backend logs will show:  
  `Magic link: CORS_ORIGIN and API_BASE_URL are not set` or `Invite: CORS_ORIGIN and API_BASE_URL are not set`.

After changing variables, redeploy the backend.

---

## 2. Supabase: Redirect URLs

Supabase must allow redirects to your app. If these URLs are not allowed, Supabase may not send the email or the link may not work.

1. Open [Supabase Dashboard](https://app.supabase.com) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add (replace with your real frontend URL):

   ```
   https://your-frontend-domain.com/auth/callback
   https://your-frontend-domain.com/accept-invite
   https://your-frontend-domain.com/reset-password
   ```

4. **Site URL** should be your frontend origin, e.g. `https://your-frontend-domain.com`.
5. Save.

---

## 3. Supabase: Email (SMTP) – Most common cause

Supabase sends magic link and invite emails. If **no custom SMTP** is set, Supabase uses its default sender, which:

- Is **rate limited** (e.g. a few emails per hour per project).
- Often lands in **spam**.
- May be **disabled or unreliable** for your project/region.

**Fix: Configure custom SMTP (recommended for production)**

1. Supabase Dashboard → **Project Settings** (gear) → **Auth** → **SMTP Settings**.
2. Enable **Custom SMTP**.
3. Fill in your provider (SendGrid, Brevo, Mailgun, etc.). Example for **Brevo**:
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - User: your Brevo login email
   - Password: your Brevo SMTP key
   - Sender email: e.g. `noreply@yourdomain.com`
   - Sender name: e.g. `QueryAI`
4. Save.

**Detailed SMTP setup:** see `SUPABASE_EMAIL_SETUP.md` and `BREVO_SMTP_SETUP.md` in this folder.

---

## 4. Check Supabase Auth logs

To see if Supabase tried to send and if it failed:

1. Supabase Dashboard → **Logs** → **Auth Logs**.
2. Trigger a magic link or invite from your app.
3. Look for errors (e.g. SMTP error, rate limit, invalid redirect).

---

## 5. Check spam and limits

- **Spam/junk:** Ask users to check spam and to whitelist your sender (or `noreply@yourdomain.com` if using custom SMTP).
- **Rate limits:** With default Supabase email, only a few emails per hour may be sent. Use custom SMTP for real usage.
- **Email provider:** Some providers (e.g. strict work filters) block or delay sign-in/invite emails. Try a personal Gmail/Outlook for testing.

---

## 6. Quick checklist

- [ ] **Railway (backend):** `CORS_ORIGIN` or `API_BASE_URL` set to frontend URL (no trailing slash).
- [ ] **Supabase → URL Configuration:** Redirect URLs include `/auth/callback`, `/accept-invite`, `/reset-password` for your frontend domain.
- [ ] **Supabase → Auth → SMTP:** Custom SMTP enabled and configured (recommended for production).
- [ ] **Supabase → Auth Logs:** No send errors when triggering magic link or invite.
- [ ] **Spam:** Check spam folder; whitelist sender if needed.

---

## 7. Links in emails

- **Magic link** → should go to: `https://your-frontend-domain.com/auth/callback#access_token=...&refresh_token=...`
- **Invite** → should go to: `https://your-frontend-domain.com/accept-invite#access_token=...&refresh_token=...`

If the domain in the link is wrong (e.g. `undefined` or localhost), fix **CORS_ORIGIN** / **API_BASE_URL** on the backend and redeploy.
