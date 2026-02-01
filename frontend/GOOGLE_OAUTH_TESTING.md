# Google OAuth Testing Checklist
## Verify Your Configuration is Working

---

## ✅ Pre-Testing Checklist

Before testing, make sure you have:

- [ ] Google OAuth Client ID created in Google Cloud Console
- [ ] Google OAuth Client Secret copied
- [ ] Supabase Google provider enabled
- [ ] Client ID added to Supabase
- [ ] Client Secret added to Supabase
- [ ] Environment variables set in `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://fargnfybpujfycgfmnco.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```
- [ ] Dependencies installed: `npm install`

---

## 🧪 Testing Steps

### Step 1: Start Development Server

```bash
cd frontend
npm run dev
```

### Step 2: Test Login Page

1. Navigate to: `http://localhost:3000/login`
2. You should see:
   - ✅ "Continue with Google" button visible
   - ✅ Button is clickable
   - ✅ Button has Google logo/icon

### Step 3: Test Google OAuth Flow

1. Click **"Continue with Google"** button
2. Expected behavior:
   - ✅ Google OAuth popup/window opens
   - ✅ Google account selection screen appears
   - ✅ You can select your Google account
   - ✅ Permission screen shows (first time only)
   - ✅ After approval, redirects to `/auth/callback`
   - ✅ Callback page shows "Completing authentication..."

### Step 4: Verify Callback

1. After Google OAuth approval:
   - ✅ Redirected to `/auth/callback` page
   - ✅ Loading spinner shows
   - ✅ Eventually redirects to dashboard or shows success

### Step 5: Check Browser Console

Open browser DevTools (F12) → Console tab:
- ✅ No errors related to Supabase
- ✅ No errors related to OAuth
- ✅ Check for any warnings

---

## 🐛 Common Issues & Solutions

### Issue 1: "Continue with Google" button doesn't appear
**Possible Causes**:
- Environment variables not set
- Supabase client not initialized

**Solutions**:
1. Check `.env.local` file exists and has correct values
2. Restart dev server: `npm run dev`
3. Check browser console for errors

### Issue 2: Button click does nothing
**Possible Causes**:
- Supabase URL/key incorrect
- JavaScript error

**Solutions**:
1. Check browser console for errors
2. Verify environment variables:
   ```bash
   # In terminal, check if variables are loaded
   echo $NEXT_PUBLIC_SUPABASE_URL
   ```
3. Make sure `.env.local` is in `frontend/` directory

### Issue 3: "redirect_uri_mismatch" error
**Possible Causes**:
- Redirect URI not in Google OAuth settings
- Wrong redirect URI format

**Solutions**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client ID
3. Make sure these are in **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback
   https://fargnfybpujfycgfmnco.supabase.co/auth/v1/callback
   ```
4. Save and try again

### Issue 4: "invalid_client" error
**Possible Causes**:
- Wrong Client ID or Secret in Supabase
- Client ID/Secret mismatch

**Solutions**:
1. Double-check Client ID in Supabase matches Google Cloud Console
2. Double-check Client Secret in Supabase matches Google Cloud Console
3. Make sure no extra spaces when copying/pasting

### Issue 5: OAuth popup blocked
**Possible Causes**:
- Browser popup blocker enabled
- Ad blocker blocking popup

**Solutions**:
1. Allow popups for `localhost:3000`
2. Disable ad blocker temporarily
3. Try in incognito/private window

### Issue 6: Callback page shows error
**Possible Causes**:
- Backend OAuth endpoint not implemented
- Session handling issue

**Solutions**:
1. Check browser console for specific error
2. This is expected if backend OAuth endpoint isn't ready yet
3. See "Backend Integration" section below

---

## 🔍 Verification Commands

### Check Environment Variables
```bash
# In frontend directory
cat .env.local | grep SUPABASE
```

Should show:
```
NEXT_PUBLIC_SUPABASE_URL=https://fargnfybpujfycgfmnco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Check Supabase Client
Open browser console and run:
```javascript
// Should not throw error
import { supabase } from '@/lib/supabase';
console.log('Supabase URL:', supabase.supabaseUrl);
```

---

## 📊 Expected Flow

```
User clicks "Continue with Google"
    ↓
Google OAuth popup opens
    ↓
User selects Google account
    ↓
User grants permissions (first time)
    ↓
Redirect to: /auth/callback
    ↓
Supabase processes OAuth callback
    ↓
Backend integration (if implemented)
    ↓
Redirect to: /dashboard
```

---

## ⚠️ Current Status

### ✅ Frontend Ready
- Google OAuth button implemented
- Callback page created
- Supabase client configured
- Mobile-responsive design

### ⚠️ Backend Integration Needed
The callback page (`/auth/callback`) currently shows an error because:
- Backend OAuth endpoint not implemented yet
- Need to create `/api/auth/oauth/google` endpoint
- Need to handle Supabase token exchange

**Workaround**: Users can still use email/password login

---

## 🚀 Next Steps

### Immediate (Testing)
1. ✅ Test Google OAuth button appears
2. ✅ Test OAuth popup opens
3. ✅ Test redirect to callback page
4. ⚠️ Backend integration for full flow

### Backend Integration (Required for Full OAuth)
1. Create `/api/auth/oauth/google` endpoint
2. Accept Supabase access token
3. Verify token with Supabase
4. Create/login user in your database
5. Return your backend tokens
6. Update callback page to use new endpoint

### Production Setup
1. Add production domain to Google OAuth redirect URIs
2. Update environment variables in Cloudflare Pages
3. Test OAuth on production domain

---

## 📝 Test Results Template

**Date**: _______________
**Tester**: _______________

### Configuration
- [ ] Google OAuth Client ID: ✅ Created
- [ ] Google OAuth Client Secret: ✅ Added to Supabase
- [ ] Supabase Google Provider: ✅ Enabled
- [ ] Environment Variables: ✅ Set

### Testing
- [ ] Google button appears: [ ] Pass [ ] Fail
- [ ] Button clickable: [ ] Pass [ ] Fail
- [ ] OAuth popup opens: [ ] Pass [ ] Fail
- [ ] Account selection works: [ ] Pass [ ] Fail
- [ ] Redirect to callback: [ ] Pass [ ] Fail
- [ ] Callback page loads: [ ] Pass [ ] Fail
- [ ] User logged in: [ ] Pass [ ] Fail (Backend pending)

### Issues Found
1. **Issue**: _______________
   - **Severity**: [ ] Critical [ ] High [ ] Medium [ ] Low
   - **Status**: [ ] Fixed [ ] Pending

### Overall Status
- **Frontend**: [ ] ✅ Ready [ ] ⚠️ Issues
- **Backend**: [ ] ✅ Ready [ ] ⚠️ Pending
- **Production**: [ ] ✅ Ready [ ] ⚠️ Pending

---

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ Click "Continue with Google" → Popup opens
2. ✅ Select account → Redirects to callback
3. ✅ Callback processes → Redirects to dashboard
4. ✅ User is logged in → Can access protected routes

**Current**: Steps 1-2 work, steps 3-4 need backend integration

---

**Ready to test!** Follow the steps above and let me know if you encounter any issues.
