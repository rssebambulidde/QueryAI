# Authentication Flow Testing Guide

## Overview

This guide provides a comprehensive checklist for testing the authentication flow end-to-end.

## Test Scenarios

### 1. User Signup Flow

#### ✅ Test Case 1.1: Successful Signup
**Steps:**
1. Navigate to `/signup`
2. Enter valid email: `test@example.com`
3. Enter valid password: `password123` (8+ characters)
4. Optionally enter full name
5. Click "Sign Up"

**Expected Result:**
- ✅ User account created
- ✅ Success message displayed
- ✅ Redirected to login (if email confirmation enabled) OR dashboard (if disabled)
- ✅ Email confirmation sent (if enabled)

#### ✅ Test Case 1.2: Signup with Existing Email
**Steps:**
1. Try to sign up with an email that already exists
2. Submit form

**Expected Result:**
- ✅ Error message: "User with this email already exists"
- ✅ Form remains on signup page
- ✅ User can correct and resubmit

#### ✅ Test Case 1.3: Signup with Invalid Email
**Steps:**
1. Enter invalid email format: `invalid-email`
2. Submit form

**Expected Result:**
- ✅ Validation error: "Invalid email format"
- ✅ Form validation prevents submission

#### ✅ Test Case 1.4: Signup with Short Password
**Steps:**
1. Enter password less than 8 characters: `short`
2. Submit form

**Expected Result:**
- ✅ Validation error: "Password must be at least 8 characters"
- ✅ Form validation prevents submission

---

### 2. User Login Flow

#### ✅ Test Case 2.1: Successful Login
**Steps:**
1. Navigate to `/login`
2. Enter valid email and password
3. Click "Sign In"

**Expected Result:**
- ✅ User authenticated
- ✅ Tokens stored in localStorage
- ✅ Redirected to `/dashboard`
- ✅ User info displayed in dashboard

#### ✅ Test Case 2.2: Login with Invalid Credentials
**Steps:**
1. Enter incorrect email or password
2. Submit form

**Expected Result:**
- ✅ Error message: "Invalid email or password"
- ✅ Form remains on login page
- ✅ User can retry

#### ✅ Test Case 2.3: Login with Non-existent Email
**Steps:**
1. Enter email that doesn't exist
2. Submit form

**Expected Result:**
- ✅ Error message: "Invalid email or password" (don't reveal if email exists)
- ✅ Security: Same error as wrong password

---

### 3. Email Confirmation Flow

#### ✅ Test Case 3.1: Email Confirmation (if enabled)
**Steps:**
1. Sign up with new account
2. Check email for confirmation link
3. Click confirmation link

**Expected Result:**
- ✅ Email received with confirmation link
- ✅ Link redirects to `/auth/confirm`
- ✅ Success message displayed
- ✅ Redirected to login after 3 seconds
- ✅ User can now login

#### ✅ Test Case 3.2: Login Before Email Confirmation
**Steps:**
1. Sign up (with email confirmation enabled)
2. Try to login before confirming email

**Expected Result:**
- ✅ Error: "Please confirm your email before logging in"
- ✅ User must confirm email first

---

### 4. Password Reset Flow

#### ✅ Test Case 4.1: Request Password Reset
**Steps:**
1. Navigate to `/forgot-password`
2. Enter registered email
3. Click "Send Reset Link"

**Expected Result:**
- ✅ Success message displayed (even if email doesn't exist - security)
- ✅ Password reset email sent (if email exists)
- ✅ Email contains reset link

#### ✅ Test Case 4.2: Reset Password
**Steps:**
1. Click reset link from email
2. Enter new password (8+ characters)
3. Confirm new password
4. Submit

**Expected Result:**
- ✅ Password updated successfully
- ✅ Redirected to login
- ✅ User can login with new password
- ✅ Old password no longer works

#### ✅ Test Case 4.3: Invalid Reset Token
**Steps:**
1. Use expired or invalid reset token
2. Try to reset password

**Expected Result:**
- ✅ Error: "Invalid or expired reset token"
- ✅ User must request new reset link

---

### 5. Protected Routes

#### ✅ Test Case 5.1: Access Dashboard Without Login
**Steps:**
1. Navigate directly to `/dashboard` (not logged in)
2. Observe behavior

**Expected Result:**
- ✅ Redirected to `/login`
- ✅ After login, redirected back to dashboard

#### ✅ Test Case 5.2: Access Dashboard With Valid Token
**Steps:**
1. Login successfully
2. Navigate to `/dashboard`

**Expected Result:**
- ✅ Dashboard loads
- ✅ User information displayed
- ✅ Chat interface available

#### ✅ Test Case 5.3: Access Dashboard With Expired Token
**Steps:**
1. Login and wait for token to expire (or manually expire)
2. Try to access dashboard

**Expected Result:**
- ✅ Token refresh attempted
- ✅ If refresh fails, redirected to login
- ✅ User must login again

---

### 6. Token Management

#### ✅ Test Case 6.1: Token Storage
**Steps:**
1. Login successfully
2. Check browser localStorage

**Expected Result:**
- ✅ `accessToken` stored in localStorage
- ✅ `refreshToken` stored in localStorage
- ✅ Tokens are valid JWT format

#### ✅ Test Case 6.2: Token Refresh
**Steps:**
1. Login successfully
2. Wait for token to near expiration
3. Make API request

**Expected Result:**
- ✅ Token automatically refreshed
- ✅ New tokens stored
- ✅ Request succeeds

#### ✅ Test Case 6.3: Logout
**Steps:**
1. Login successfully
2. Click "Logout"

**Expected Result:**
- ✅ Tokens removed from localStorage
- ✅ Redirected to login page
- ✅ Cannot access protected routes

---

## Manual Testing Checklist

### Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

### Network Testing
- [ ] Slow network connection
- [ ] Offline mode
- [ ] Network interruption during requests

### Security Testing
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Token security
- [ ] Password strength requirements

---

## API Testing

### Using cURL

#### Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

#### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

#### Get Current User
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Automated Testing

Run the test suite:
```bash
cd backend
npm test
```

---

## Common Issues

### Issue: "Invalid API key"
- **Solution:** Check `SUPABASE_SERVICE_ROLE_KEY` in environment variables

### Issue: "Email confirmation not sent"
- **Solution:** Check SMTP configuration in Supabase or disable email confirmation

### Issue: "CORS error"
- **Solution:** Verify `CORS_ORIGIN` matches frontend URL

### Issue: "Token expired"
- **Solution:** Implement token refresh or re-login

---

## Success Criteria

✅ All test cases pass
✅ No security vulnerabilities
✅ Proper error handling
✅ User-friendly error messages
✅ Smooth user experience
