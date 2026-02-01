# Supabase Google OAuth Setup Guide
## Complete Step-by-Step Instructions

This guide will walk you through setting up Google OAuth authentication with Supabase.

---

## 📋 Prerequisites

- Google account
- Supabase account (already created)
- Your Supabase project URL: `https://fargnfybpujfycgfmnco.supabase.co`

---

## 🔧 Step 1: Create Google Cloud Project

### 1.1 Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Sign in with your Google account

### 1.2 Create a New Project
1. Click the project dropdown at the top (next to "Google Cloud")
2. Click **"New Project"**
3. Enter project name: `QueryAI` (or any name you prefer)
4. Click **"Create"**
5. Wait for project creation (takes a few seconds)
6. Select the newly created project from the dropdown

---

## 🔑 Step 2: Enable Google+ API

### 2.1 Enable Google+ API
1. In Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"Google Identity Services API"**
3. Click on **"Google Identity Services API"** (or Google+ API)
4. Click **"Enable"**
5. Wait for it to enable

**Note**: Google+ API is being deprecated, but you can also use:
- **Google Identity Services API** (recommended)
- Or skip this step if using OAuth 2.0 directly

---

## 🔐 Step 3: Create OAuth 2.0 Credentials

### 3.1 Navigate to Credentials
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

### 3.2 Configure OAuth Consent Screen (First Time Only)
If this is your first OAuth credential, you'll need to configure the consent screen:

1. **User Type**: Select **"External"** (unless you have a Google Workspace)
2. Click **"Create"**

3. **App Information**:
   - **App name**: `QueryAI` (or your app name)
   - **User support email**: Your email address
   - **App logo**: (Optional) Upload your app logo
   - **App domain**: Your domain (e.g., `queryai.com`)
   - **Developer contact information**: Your email address

4. Click **"Save and Continue"**

5. **Scopes** (Optional):
   - Click **"Add or Remove Scopes"**
   - Select:
     - `userinfo.email`
     - `userinfo.profile`
     - `openid`
   - Click **"Update"**
   - Click **"Save and Continue"**

6. **Test Users** (Optional for testing):
   - Add test user emails if needed
   - Click **"Save and Continue"**

7. **Summary**:
   - Review your settings
   - Click **"Back to Dashboard"**

### 3.3 Create OAuth Client ID
1. Go back to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**

3. **Application type**: Select **"Web application"**

4. **Name**: `QueryAI Web Client` (or any name)

5. **Authorized JavaScript origins**:
   Add these URLs (one per line):
   ```
   http://localhost:3000
   https://your-production-domain.com
   https://fargnfybpujfycgfmnco.supabase.co
   ```
   **Important**: Replace `your-production-domain.com` with your actual production domain

6. **Authorized redirect URIs**:
   Add these URLs (one per line):
   ```
   http://localhost:3000/auth/callback
   https://your-production-domain.com/auth/callback
   https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback
   ```
   **Important**: 
   - Replace `your-production-domain.com` with your actual production domain
   - The Supabase callback URL is: `https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback`

7. Click **"Create"**

8. **Copy Your Credentials**:
   - A popup will show your **Client ID** and **Client Secret**
   - **IMPORTANT**: Copy both immediately - you won't be able to see the secret again!
   - If you lose the secret, you'll need to create a new credential

---

## 🌐 Step 4: Create Additional Client IDs (Optional)

### 4.1 For Android Apps (if needed)
1. Create another OAuth client ID
2. **Application type**: **"Android"**
3. **Package name**: Your Android app package name
4. **SHA-1 certificate fingerprint**: Your app's SHA-1 fingerprint
5. Click **"Create"**

### 4.2 For iOS Apps (if needed)
1. Create another OAuth client ID
2. **Application type**: **"iOS"**
3. **Bundle ID**: Your iOS app bundle ID
4. Click **"Create"**

### 4.3 For Chrome Extensions (if needed)
1. Create another OAuth client ID
2. **Application type**: **"Chrome app"**
3. **Application ID**: Your Chrome extension ID
4. Click **"Create"**

---

## 🔗 Step 5: Configure Supabase

### 5.1 Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard
2. Select your project: `fargnfybpujfycgfmnco`

### 5.2 Navigate to Authentication Settings
1. Click **"Authentication"** in the left sidebar
2. Click **"Providers"** tab
3. Find **"Google"** in the list
4. Click to expand Google settings

### 5.3 Configure Google Provider
Fill in the following fields:

1. **Enable Sign in with Google**: ✅ Toggle ON

2. **Client IDs**:
   - Paste your **Client ID** from Step 3.3
   - If you have multiple client IDs (Android, iOS, etc.), separate them with commas:
   ```
   your-web-client-id.apps.googleusercontent.com, your-android-client-id.apps.googleusercontent.com
   ```

3. **Client Secret (for OAuth)**:
   - Paste your **Client Secret** from Step 3.3
   - This is the secret you copied when creating the OAuth client

4. **Skip nonce checks**:
   - Leave **OFF** (more secure)
   - Only enable if you have specific nonce issues

5. **Allow users without an email**:
   - Leave **OFF** (recommended)
   - Only enable if you need to allow users without email addresses

6. **Callback URL** (Already set by Supabase):
   ```
   https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback
   ```
   - This is automatically configured
   - Make sure this URL is in your Google OAuth redirect URIs (Step 3.3)

7. Click **"Save"**

---

## ✅ Step 6: Verify Configuration

### 6.1 Test in Development
1. Make sure your `.env.local` has:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://fargnfybpujfycgfmnco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Start your development server:
   ```bash
   npm run dev
   ```

3. Go to `http://localhost:3000/login`
4. Click **"Continue with Google"**
5. You should see Google OAuth popup
6. Select your Google account
7. You should be redirected back to your app

### 6.2 Common Issues

**Issue**: "redirect_uri_mismatch" error
- **Solution**: Make sure `http://localhost:3000/auth/callback` is in your Google OAuth redirect URIs

**Issue**: "invalid_client" error
- **Solution**: Double-check your Client ID and Client Secret in Supabase

**Issue**: OAuth popup doesn't open
- **Solution**: Check browser console for errors, verify Supabase env variables

---

## 🔒 Step 7: Production Setup

### 7.1 Update Google OAuth Credentials
1. Go back to Google Cloud Console → **"Credentials"**
2. Edit your OAuth client ID
3. Add your production domain to:
   - **Authorized JavaScript origins**: `https://your-production-domain.com`
   - **Authorized redirect URIs**: `https://your-production-domain.com/auth/callback`

### 7.2 Update Supabase Environment Variables
1. In Cloudflare Pages (or your hosting platform)
2. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://fargnfybpujfycgfmnco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 7.3 Test Production
1. Deploy your app
2. Test Google OAuth on production domain
3. Verify callback works correctly

---

## 📝 Quick Reference

### Your Supabase Project
- **Project URL**: `https://fargnfybpujfycgfmnco.supabase.co`
- **Callback URL**: `https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback`

### Google Cloud Console
- **URL**: https://console.cloud.google.com
- **Credentials**: APIs & Services → Credentials

### Supabase Dashboard
- **URL**: https://supabase.com/dashboard
- **Auth Settings**: Authentication → Providers → Google

---

## 🎯 Checklist

- [ ] Created Google Cloud project
- [ ] Enabled Google Identity Services API
- [ ] Configured OAuth consent screen
- [ ] Created OAuth client ID (Web application)
- [ ] Added authorized JavaScript origins
- [ ] Added authorized redirect URIs (including Supabase callback)
- [ ] Copied Client ID and Client Secret
- [ ] Configured Google provider in Supabase
- [ ] Added Client ID to Supabase
- [ ] Added Client Secret to Supabase
- [ ] Enabled "Sign in with Google" in Supabase
- [ ] Tested in development
- [ ] Updated production credentials
- [ ] Tested in production

---

## 🔐 Security Best Practices

1. **Never commit secrets to git**
   - Keep Client Secret in environment variables only
   - Use `.env.local` for development
   - Use hosting platform env vars for production

2. **Use different credentials for dev/prod**
   - Create separate OAuth clients for development and production
   - Or use the same client but restrict origins/redirects

3. **Keep Client Secret secure**
   - Only store in Supabase dashboard (encrypted)
   - Never expose in frontend code
   - Rotate if compromised

4. **Monitor OAuth usage**
   - Check Google Cloud Console for unusual activity
   - Monitor Supabase auth logs

---

## 📚 Additional Resources

- **Google OAuth Documentation**: https://developers.google.com/identity/protocols/oauth2
- **Supabase Auth Documentation**: https://supabase.com/docs/guides/auth
- **Supabase Google Provider**: https://supabase.com/docs/guides/auth/social-login/auth-google

---

## 🆘 Troubleshooting

### Error: "redirect_uri_mismatch"
- **Cause**: Redirect URI not in authorized list
- **Fix**: Add exact redirect URI to Google OAuth credentials

### Error: "invalid_client"
- **Cause**: Wrong Client ID or Secret
- **Fix**: Double-check values in Supabase dashboard

### Error: "access_denied"
- **Cause**: User denied permission or consent screen not configured
- **Fix**: Configure OAuth consent screen properly

### OAuth popup blocked
- **Cause**: Browser popup blocker
- **Fix**: Allow popups for your domain

---

**Last Updated**: February 1, 2026
**Status**: Ready to use
