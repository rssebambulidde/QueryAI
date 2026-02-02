# Test Checklist: Magic Link & Today's Fixes

Use this checklist to manually verify the magic link flow and other fixes implemented today.

---

## 1. Magic Link (passwordless login)

### Backend (unit tests)
- [x] **AuthService.requestMagicLink** – unit tests pass (`npm test -- auth-service.test.ts`)

### Manual E2E
- [ ] **Request magic link**
  1. Go to `/login`
  2. Click “Sign in with magic link”
  3. Enter a valid email (e.g. your test account)
  4. Click “Send magic link”
  - **Expected:** Message “We sent a login link to &lt;email&gt;. Click the link in the email to sign in.”
- [ ] **Use magic link**
  1. Open the email and click the link
  2. **Expected:** Redirect to `/auth/callback`, then to `/dashboard` (signed in)
- [ ] **Invalid email**
  - Enter invalid email (e.g. `invalid`) and submit
  - **Expected:** Validation error or same success message (no email enumeration)

---

## 2. Invite user

### Backend (unit tests)
- [x] **AuthService.inviteUserByEmail** – unit tests pass

### Manual E2E
- [ ] **Invite from Team settings (logged in)**
  1. Log in, go to **Dashboard → Settings → Team** (Enterprise plan)
  2. Enter a friend’s email, click “Send Invitation”
  - **Expected:** Toast “Invitation sent. They will receive an email to set up their account.”
- [ ] **Invite from signup page (not logged in)**
  1. Go to `/signup`
  2. In “Invite a friend”, enter an email and click “Send invite”
  - **Expected:** “Invitation sent. Your friend will receive an email to set up their account.”
- [ ] **Accept invite**
  1. Open invite email and click the link
  2. **Expected:** Land on `/accept-invite`, set password form visible
  3. Enter password + confirm, submit
  - **Expected:** “You’re all set”, then redirect to `/dashboard` (signed in)

---

## 3. Password reset (auth header fix)

### Manual E2E
- [ ] **Request reset**
  1. Go to `/forgot-password`, enter email, submit
  - **Expected:** Success message
- [ ] **Reset password**
  1. Click link in email (goes to `/reset-password#access_token=...&refresh_token=...`)
  2. Enter new password + confirm, submit
  - **Expected:** “Password Reset Successful!”, redirect to `/login` (no “Authorization header missing” error)

---

## 4. Login / signup – password visibility

### Manual E2E
- [ ] **Login**
  - Go to `/login`
  - **Expected:** Password field has show/hide (eye) toggle
- [ ] **Signup**
  - Go to `/signup`
  - **Expected:** Password field has show/hide toggle
- [ ] **Reset password**
  - On `/reset-password` page
  - **Expected:** New password and confirm fields have show/hide toggles

---

## 5. Citation settings (iPhone 7 / small mobile)

### Manual E2E (viewport 375×667 or similar)
- [ ] Open a conversation with citations
- [ ] Open citation settings (gear or “Citation settings”)
- [ ] **Expected:** Modal fits viewport; “Done” button visible and clickable (no cut-off at bottom)
- [ ] Scroll content if needed, then tap “Done”
- [ ] **Expected:** Modal closes

---

## 6. Add to collection (iPhone 7 / small mobile)

### Manual E2E
- [ ] From chat or sidebar, use “Add to collection” / “Save to collection”
- [ ] **Expected:** Dialog fits viewport; “Save” (or primary action) visible and clickable
- [ ] **Expected:** No horizontal overflow, no button hidden behind keyboard

---

## 7. New conversation greeting

### Manual E2E
- [ ] Start a **new** conversation (no messages yet)
- [ ] **Expected:** Time-based greeting with first name (e.g. “Good morning, Robert!”)
- [ ] **Expected:** No greeting on existing conversations (or only when empty)

---

## 8. Conversation thread scroll arrows

### Manual E2E
- [ ] Open a conversation with many messages (long thread)
- [ ] **Expected:** Small up/down arrow buttons (e.g. right side) to jump to top/bottom
- [ ] Click up arrow → scroll to top
- [ ] Click down arrow → scroll to bottom

---

## 9. Profile photo display

### Manual E2E
- [ ] Go to **Settings → Profile**
- [ ] Upload or change profile photo and save
- [ ] **Expected:** New avatar shows immediately (no stale cached image)
- [ ] **Expected:** Avatar appears in sidebar/account dropdown after refresh if applicable

---

## 10. Free-tier / limit error messages

### Manual E2E
- [ ] As free-tier user, create topics up to limit, then try one more
  - **Expected:** Clear message about topic limit (not generic 403)
- [ ] Hit document upload limit
  - **Expected:** Clear message about upload limit
- [ ] **Expected:** No raw “limit exceeded” or stack traces in UI

---

## Quick commands

```bash
# Backend auth unit tests (magic link + invite + validation)
cd backend && npx jest src/__tests__/auth-service.test.ts

# Full backend test suite (optional; some tests need env vars)
cd backend && npm test
```

---

**Date:** _______________  
**Tester:** _______________  
**Browser/device:** _______________  
**Notes:** _______________
