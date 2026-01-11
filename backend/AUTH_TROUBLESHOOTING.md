# Authentication Endpoints Troubleshooting

## Issue: Endpoints Not Responding

If authentication endpoints are not responding, check the following:

### 1. Verify Server is Running

Check if the server is operational:
```bash
GET https://your-app.railway.app/health
```

Should return:
```json
{
  "success": true,
  "database": { "connected": true }
}
```

### 2. Test Routes are Registered

Test if routes are working:
```bash
GET https://your-app.railway.app/api/test
```

Should return:
```json
{
  "success": true,
  "message": "Test endpoint is working!"
}
```

### 3. Check Supabase Auth Configuration

**Important:** Ensure Supabase Auth is properly configured:

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Check **Site URL** is set correctly
3. Check **Redirect URLs** includes your Railway domain
4. Verify **Email Auth** is enabled
5. Check **Email Templates** are configured

### 4. Verify Environment Variables

Ensure these are set in Railway:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### 5. Check Railway Logs

View logs in Railway Dashboard → **Logs** tab:
- Look for error messages
- Check for authentication errors
- Verify requests are reaching the server

### 6. Test with curl/Postman

Test signup endpoint:
```bash
curl -X POST https://your-app.railway.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'
```

### 7. Common Issues

#### Issue: "User already registered"
- User with that email already exists
- Try a different email or login instead

#### Issue: "Invalid email format"
- Email must be valid format (e.g., user@example.com)

#### Issue: "Password too short"
- Password must be at least 8 characters

#### Issue: CORS Error
- Check `CORS_ORIGIN` environment variable
- Ensure your frontend domain is allowed

#### Issue: Rate Limit
- Auth endpoints limited to 5 requests per 15 minutes
- Wait before retrying

### 8. Supabase Auth Settings

**Email Confirmation:**
- If email confirmation is enabled, users won't get a session immediately
- Check Supabase Dashboard → Authentication → Settings
- Disable "Enable email confirmations" for testing

**Site URL:**
- Set to your Railway domain: `https://your-app.railway.app`
- Or your frontend domain

**Redirect URLs:**
- Add: `https://your-app.railway.app/**`
- Add: `http://localhost:3000/**` (for local testing)

### 9. Debug Steps

1. **Check Server Logs:**
   - Railway Dashboard → Logs
   - Look for "Signup request received" or "Login request received"
   - Check for error messages

2. **Test Database Connection:**
   - `/health` endpoint should show database connected

3. **Test Route Registration:**
   - `/api/test` should work
   - `/api/test/auth-routes` should list endpoints

4. **Verify Supabase:**
   - Go to Supabase Dashboard
   - Check Authentication → Users
   - See if users are being created

### 10. Quick Test Checklist

- [ ] Server is running (`/health` works)
- [ ] Test endpoint works (`/api/test` works)
- [ ] Supabase URL and keys are correct
- [ ] Email confirmation is disabled (for testing)
- [ ] Site URL is set in Supabase
- [ ] Redirect URLs include Railway domain
- [ ] CORS is configured correctly
- [ ] No rate limit errors
- [ ] Check Railway logs for errors

### 11. Still Not Working?

If endpoints still don't respond:

1. **Check Railway Deployment:**
   - Ensure latest code is deployed
   - Check build logs for errors
   - Verify environment variables are set

2. **Check Supabase:**
   - Verify project is active
   - Check API keys are correct
   - Ensure Auth is enabled

3. **Check Network:**
   - Test from different network
   - Check if Railway domain is accessible
   - Verify SSL certificate is valid

4. **Contact Support:**
   - Railway support: [railway.app/support](https://railway.app/support)
   - Supabase support: [supabase.com/support](https://supabase.com/support)

---

## Expected Behavior

### Successful Signup Response:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "fullName": "Test User"
    },
    "session": {
      "accessToken": "jwt-token...",
      "refreshToken": "refresh-token...",
      "expiresIn": 3600
    }
  }
}
```

### Successful Login Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "fullName": "Test User"
    },
    "session": {
      "accessToken": "jwt-token...",
      "refreshToken": "refresh-token...",
      "expiresIn": 3600
    }
  }
}
```

---

**Last Updated:** January 11, 2026
