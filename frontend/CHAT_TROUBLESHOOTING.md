# Chat Interface Troubleshooting Guide

## Common Issues and Solutions

### 1. "Streaming request failed" Error

This error typically occurs when the backend cannot process the AI request. Here are the most common causes:

#### Issue: Missing OpenAI API Key

**Symptoms:**
- Error message: "Streaming request failed" or "AI service error"
- Backend logs show: "OpenAI API key not configured"

**Solution:**
1. Check if `OPENAI_API_KEY` is set in your backend environment variables
2. For local development, add to `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
3. For Railway deployment, add the variable in Railway dashboard:
   - Go to your backend service → Variables tab
   - Add `OPENAI_API_KEY` with your OpenAI API key
   - Redeploy the service

**Get your OpenAI API key:**
- Visit https://platform.openai.com/api-keys
- Create a new secret key
- Copy and add to environment variables

---

#### Issue: Backend Not Running

**Symptoms:**
- Error message: "Streaming request failed: Failed to fetch"
- Network error in browser console

**Solution:**
1. Check if backend is running:
   ```bash
   cd backend
   npm run dev
   ```
2. Verify backend URL in frontend `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
3. For production, ensure backend is deployed and URL is correct

---

#### Issue: Authentication Token Missing

**Symptoms:**
- Error message: "Streaming request failed: Unauthorized"
- 401 status code

**Solution:**
1. Ensure you're logged in
2. Check if token is stored in localStorage:
   - Open browser DevTools → Application → Local Storage
   - Look for `accessToken`
3. Try logging out and logging back in
4. Check backend authentication middleware

---

#### Issue: CORS Error

**Symptoms:**
- Error in browser console: "CORS policy" or "Access-Control-Allow-Origin"
- Network request blocked

**Solution:**
1. Check backend CORS configuration in `backend/src/server.ts`
2. Ensure frontend URL is in allowed origins:
   ```typescript
   CORS_ORIGIN=http://localhost:3000  // For local dev
   ```
3. For production, add your frontend domain to CORS_ORIGIN

---

### 2. Messages Not Streaming

**Symptoms:**
- Message sent but no response appears
- Typing indicator shows but no text

**Solution:**
1. Check browser console for errors
2. Verify backend streaming endpoint is working:
   ```bash
   curl -X POST http://localhost:3001/api/ai/ask/stream \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"question": "test"}'
   ```
3. Check backend logs for errors
4. The chat interface will automatically fall back to non-streaming if streaming fails

---

### 3. Error Messages Not Showing

**Symptoms:**
- Error occurs but user doesn't see it
- Chat appears stuck

**Solution:**
1. Check browser console for detailed errors
2. Check network tab for failed requests
3. Verify error boundary is working
4. Check toast notifications (top-right corner)

---

## Debugging Steps

### 1. Check Browser Console

Open DevTools (F12) → Console tab:
- Look for error messages
- Check network requests
- Verify API calls are being made

### 2. Check Network Tab

DevTools → Network tab:
- Find the `/api/ai/ask/stream` request
- Check request headers (Authorization token)
- Check response status and body
- Look for CORS errors

### 3. Check Backend Logs

If running locally:
```bash
cd backend
npm run dev
```

Look for:
- Authentication errors
- OpenAI API errors
- Request/response logs

### 4. Test Backend Directly

Test the streaming endpoint:
```bash
# Get your auth token first (from localStorage or login response)
curl -X POST http://localhost:3001/api/ai/ask/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"question": "Hello"}'
```

---

## Environment Variables Checklist

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend (`.env` or Railway Variables)
```env
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGIN=http://localhost:3000

# Optional but recommended
NODE_ENV=development
LOG_LEVEL=info
```

---

## Quick Fixes

### Restart Everything
```bash
# Stop all servers
# Then restart:

# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Clear Browser Cache
- Clear localStorage
- Clear cookies
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Re-authenticate
- Log out
- Log back in
- Check if new token is generated

---

## Still Having Issues?

1. **Check the error message** - It should now show more details
2. **Check backend logs** - Look for specific error messages
3. **Verify environment variables** - Ensure all required keys are set
4. **Test with non-streaming** - The chat will automatically fall back
5. **Check OpenAI API status** - Visit https://status.openai.com/

---

## Support

For more help:
- Check backend logs for detailed error messages
- Review `backend/PHASE_1.4_AI_INTEGRATION.md` for AI setup
- Review `frontend/PHASE_1.6_COMPLETE.md` for chat interface details
