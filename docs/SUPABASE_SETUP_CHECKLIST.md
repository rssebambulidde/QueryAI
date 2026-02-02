# What to Set Up in Supabase (QueryAI)

One-page checklist for Supabase Dashboard. Use your **QueryAI** project at [app.supabase.com](https://app.supabase.com).

---

## 1. URL configuration (required)

**Path:** **Authentication** → **URL Configuration**

| Setting | Development | Production |
|--------|-------------|------------|
| **Site URL** | `http://localhost:3000` | `https://your-frontend-domain.com` |

**Redirect URLs** – add every URL your app redirects to after auth emails:

**Development:**
```
http://localhost:3000
http://localhost:3000/reset-password
http://localhost:3000/auth/callback
http://localhost:3000/accept-invite
```

**Production** (replace `your-frontend-domain.com` with your real domain):
```
https://your-frontend-domain.com
https://your-frontend-domain.com/reset-password
https://your-frontend-domain.com/auth/callback
https://your-frontend-domain.com/accept-invite
```

- `/reset-password` – password reset link
- `/auth/callback` – magic link (passwordless login)
- `/accept-invite` – invite user (set password and join)

Click **Save**.

---

## 2. Email confirmation (optional)

**Path:** **Authentication** → **Settings** → **Email Auth**

| Environment | **Enable Email Confirmations** |
|-------------|-------------------------------|
| Development | **OFF** (sign up and log in immediately) |
| Production  | **ON** (user must confirm email first) |

Click **Save**.

---

## 3. Email templates (optional but recommended)

**Path:** **Authentication** → **Email Templates**

You can customize:

| Template | When it’s used |
|----------|----------------|
| **Confirm signup** | New user signup (if email confirmation is ON) |
| **Reset Password** | User requested “Forgot password” |
| **Magic Link** | User requested “Sign in with magic link” |
| **Invite user** | Someone invited a user (Team / signup “Invite a friend”) |
| **Change Email Address** | User requested email change |

Copy/paste HTML from **backend/docs/SUPABASE_EMAIL_SETUP.md** for each template you want to customize.  
For reset password “button only” (no “copy and paste this link”), use **backend/docs/SUPABASE_RESET_PASSWORD_EMAIL.md**.

---

## 4. SMTP (production)

**Path:** **Project Settings** (gear) → **Auth** → **SMTP Settings**

- **Development:** Supabase default is OK (limited emails, may go to spam).
- **Production:** Turn on **Enable Custom SMTP** and set your provider (e.g. SendGrid, Brevo, Mailgun).  
  See **backend/docs/BREVO_SMTP_SETUP.md** or **SUPABASE_EMAIL_SETUP.md** for examples.

---

## 5. Environment variables (backend)

Your backend needs these (e.g. in Railway / `.env`):

| Variable | Where to get it (Supabase) |
|----------|----------------------------|
| `SUPABASE_URL` | **Project Settings** → **API** → Project URL |
| `SUPABASE_ANON_KEY` | **Project Settings** → **API** → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings** → **API** → service_role (keep secret) |

Your backend also needs the frontend URL for redirects:

| Variable | Example |
|----------|--------|
| `CORS_ORIGIN` or `API_BASE_URL` | `https://your-frontend-domain.com` (or `http://localhost:3000` for dev) |

---

## Quick checklist

- [ ] **Authentication** → **URL Configuration**: Site URL and Redirect URLs set (including `/reset-password`, `/auth/callback`, `/accept-invite`)
- [ ] **Authentication** → **Settings** → **Email Auth**: Email confirmations ON/OFF as desired
- [ ] **Authentication** → **Email Templates**: Customize Reset Password (and others if you want)
- [ ] **Project Settings** → **Auth** → **SMTP**: Custom SMTP for production (optional for dev)
- [ ] Backend env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and frontend URL (`CORS_ORIGIN` / `API_BASE_URL`)

---

**More detail:** **backend/docs/SUPABASE_EMAIL_SETUP.md** and **backend/docs/SUPABASE_QUICK_SETUP.md**.
