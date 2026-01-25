# Deep Debugging Network Error - All Setup Correct

## If Everything is Set Up But Still Getting Network Error

### Step 1: Verify Environment Variable is Actually Loaded

**In Browser Console (F12):**
```javascript
// Check if variable is available
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// If undefined, the variable isn't being loaded
// Next.js only exposes NEXT_PUBLIC_ variables at BUILD TIME
```

**Important:** `NEXT_PUBLIC_` variables are embedded at **build time**, not runtime. If you added the variable after building, you need to rebuild.

### Step 2: Check Network Tab in Browser

1. Open Developer Tools (F12) → **Network** tab
2. Try to login
3. Look for the failed request
4. Check:
   - **Request URL:** What URL is it trying to hit?
   - **Status Code:** What error code? (CORS, 404, 500, etc.)
   - **Error Message:** What's the exact error?

### Step 3: Verify Backend is Receiving Requests

**Check Railway Logs:**
1. Go to Railway Dashboard → Your Backend Service
2. Go to **Logs** tab
3. Try logging in
4. Do you see any incoming requests in the logs?
   - **If NO requests appear:** Frontend isn't reaching backend (network/CORS issue)
   - **If requests appear:** Backend is receiving them (check backend error)

### Step 4: Test Backend Directly

**In Browser:**
```
https://your-backend.railway.app/health
```

**Should return:**
```json
{"status":"healthy",...}
```

**If this fails:** Backend is down or URL is wrong.

### Step 5: Test Login Endpoint Directly

**In Browser Console or using curl:**
```javascript
// In browser console
fetch('https://your-backend.railway.app/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123456'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Check for:**
- CORS errors in console
- Network errors
- Backend response

### Step 6: Check CORS Preflight

**In Network Tab:**
1. Look for an **OPTIONS** request before the POST request
2. Check if OPTIONS request succeeds (200) or fails
3. If OPTIONS fails: CORS configuration issue

**Common CORS Issues:**
- Backend `CORS_ORIGIN` doesn't include Cloudflare Pages URL
- Missing headers in CORS response
- Preflight failing

### Step 7: Verify Cloudflare Pages Environment Variable

**In Cloudflare Dashboard:**
1. Pages → Your Project → Settings → Environment Variables
2. Verify `NEXT_PUBLIC_API_URL` exists
3. Check the value is correct (no typos)
4. Verify it's set for **Production** (not just Preview)
5. **Important:** After adding/changing, you MUST redeploy

### Step 8: Force Rebuild

**Option A: Retry Deployment**
1. Cloudflare Pages → Deployments
2. Click **Retry deployment** on latest

**Option B: Trigger New Build**
1. Make a small change (add a comment)
2. Commit and push
3. This forces a new build with environment variables

### Step 9: Check for Mixed Content Issues

**If frontend is HTTPS but API URL is HTTP:**
- Browser blocks mixed content
- Ensure API URL uses `https://`

### Step 10: Check Browser Console for Specific Errors

**Common Error Messages:**

1. **"CORS policy: No 'Access-Control-Allow-Origin' header"**
   - Fix: Add Cloudflare Pages URL to backend `CORS_ORIGIN`

2. **"Failed to fetch" or "NetworkError"**
   - Could be: CORS, backend down, wrong URL, SSL issue

3. **"ERR_CONNECTION_REFUSED"**
   - Backend is not accessible at that URL

4. **"ERR_SSL_PROTOCOL_ERROR"**
   - SSL/HTTPS configuration issue

## Quick Diagnostic Script

**Paste this in Browser Console (F12):**

```javascript
(async () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  console.log('🔍 Diagnostic Check:');
  console.log('1. API URL:', apiUrl);
  
  // Test health endpoint
  try {
    const health = await fetch(`${apiUrl}/health`);
    const healthData = await health.json();
    console.log('2. Health check:', health.ok ? '✅ PASS' : '❌ FAIL', healthData);
  } catch (e) {
    console.log('2. Health check: ❌ FAIL', e.message);
  }
  
  // Test CORS
  try {
    const cors = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { 'Origin': window.location.origin }
    });
    console.log('3. CORS preflight:', cors.ok ? '✅ PASS' : '❌ FAIL', cors.status);
  } catch (e) {
    console.log('3. CORS preflight: ❌ FAIL', e.message);
  }
  
  // Test actual login endpoint (will fail auth, but should get response)
  try {
    const login = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test', password: 'test' })
    });
    const loginData = await login.json();
    console.log('4. Login endpoint:', login.ok ? '✅ RESPONDS' : '⚠️ RESPONDS (auth failed)', loginData);
  } catch (e) {
    console.log('4. Login endpoint: ❌ FAIL', e.message);
  }
})();
```

**This will show:**
- What API URL is being used
- If backend is reachable
- If CORS is configured
- If login endpoint responds

## Most Likely Issues (When Setup Looks Correct)

1. **Environment variable added after build** → Need to rebuild
2. **CORS not configured** → Backend `CORS_ORIGIN` missing Cloudflare Pages URL
3. **Wrong environment** → Variable set for Preview, not Production
4. **Typo in URL** → Double-check the Railway backend URL
5. **Backend not running** → Check Railway logs
6. **SSL/Certificate issue** → Backend URL not using HTTPS

## Next Steps

After running diagnostics, share:
1. What the diagnostic script outputs
2. What you see in Network tab (failed request details)
3. What Railway logs show (any incoming requests?)
4. What browser console shows (any CORS errors?)

---

**Last Updated:** 2026-01-25
