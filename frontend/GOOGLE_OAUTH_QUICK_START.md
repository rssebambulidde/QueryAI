# Google OAuth Quick Start Guide
## Fast Setup for Supabase Google Authentication

---

## 🚀 Quick Steps (5 minutes)

### Step 1: Google Cloud Console Setup

1. **Go to**: https://console.cloud.google.com
2. **Create Project**: Click project dropdown → "New Project" → Name it "QueryAI" → Create
3. **Enable API**: Go to "APIs & Services" → "Library" → Search "Google Identity Services API" → Enable
4. **Create Credentials**: 
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - If prompted, configure OAuth consent screen:
     - User Type: **External**
     - App name: **QueryAI**
     - Support email: **Your email**
     - Save and Continue through all steps

5. **Create OAuth Client**:
   - Application type: **Web application**
   - Name: **QueryAI Web**
   - **Authorized JavaScript origins** (add these):
     ```
     http://localhost:3000
     https://fargnfybpujfycgfmnco.supabase.co
     ```
   - **Authorized redirect URIs** (add these):
     ```
     http://localhost:3000/auth/callback
     https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback
     ```
   - Click **"Create"**
   - **COPY Client ID and Client Secret** (you'll need these!)

---

### Step 2: Supabase Configuration

1. **Go to**: https://supabase.com/dashboard
2. **Select Project**: `fargnfybpujfycgfmnco`
3. **Navigate**: Authentication → Providers → Google
4. **Configure**:
   - ✅ **Enable Sign in with Google**: Toggle ON
   - **Client IDs**: Paste your Client ID from Step 1
   - **Client Secret**: Paste your Client Secret from Step 1
   - **Skip nonce checks**: Leave OFF
   - **Allow users without an email**: Leave OFF
   - Click **"Save"**

---

### Step 3: Add to Your App

1. **Add to `.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://fargnfybpujfycgfmnco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

2. **Get Supabase Anon Key**:
   - In Supabase Dashboard → Settings → API
   - Copy the `anon` `public` key

3. **Test**:
   ```bash
   npm run dev
   ```
   - Go to http://localhost:3000/login
   - Click "Continue with Google"
   - Should work! 🎉

---

## 📋 What You Need to Copy

### From Google Cloud Console:
- ✅ **Client ID**: `xxxxx.apps.googleusercontent.com`
- ✅ **Client Secret**: `GOCSPX-xxxxx` (long string)

### From Supabase Dashboard:
- ✅ **Project URL**: `https://fargnfybpujfycgfmnco.supabase.co`
- ✅ **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long JWT token)

---

## 🔗 Important URLs

### Your Supabase Callback URL:
```
https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback
```
**This MUST be in your Google OAuth redirect URIs!**

### Your App Callback URL (Development):
```
http://localhost:3000/auth/callback
```

### Your App Callback URL (Production):
```
https://your-production-domain.com/auth/callback
```

---

## ✅ Checklist

- [ ] Google Cloud project created
- [ ] OAuth client ID created (Web application)
- [ ] Redirect URIs added (including Supabase callback)
- [ ] Client ID copied
- [ ] Client Secret copied
- [ ] Supabase Google provider enabled
- [ ] Client ID added to Supabase
- [ ] Client Secret added to Supabase
- [ ] Environment variables set in `.env.local`
- [ ] Tested Google login button

---

## 🐛 Common Issues

**"redirect_uri_mismatch"**
- ✅ Make sure `https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback` is in redirect URIs

**"invalid_client"**
- ✅ Double-check Client ID and Secret in Supabase match Google Cloud Console

**Button doesn't work**
- ✅ Check `.env.local` has correct Supabase URL and anon key
- ✅ Check browser console for errors

---

## 📚 Full Guide

For detailed instructions, see: `SUPABASE_GOOGLE_OAUTH_SETUP.md`

---

**Quick Reference**: Keep this file handy while setting up!
