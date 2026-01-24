# Frontend-Backend Communication Verification

This document verifies that the frontend and backend are properly configured to communicate with each other.

## ✅ Current Configuration Analysis

### Frontend API Configuration (`frontend/lib/api.ts`)

**Base URL:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**Features:**
- ✅ Uses `NEXT_PUBLIC_API_URL` environment variable
- ✅ Defaults to `http://localhost:3001` for local development
- ✅ Axios instance configured with baseURL
- ✅ Request interceptor adds `Authorization: Bearer <token>` header
- ✅ Response interceptor handles 401 errors (redirects to login)
- ✅ Token retrieved from `localStorage.getItem('accessToken')`

**API Client Setup:**
```typescript
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Backend CORS Configuration (`backend/src/server.ts`)

**CORS Setup:**
```typescript
const corsOptions = {
  origin: (origin, callback) => {
    // Allows requests with no origin
    // Parses CORS_ORIGIN (comma-separated)
    // Includes Cloudflare Pages URL if set
    // Includes localhost for development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

**Allowed Origins:**
1. Origins from `CORS_ORIGIN` environment variable (comma-separated)
2. `https://${process.env.CLOUDFLARE_PAGES_URL}` (if set)
3. `http://localhost:3000` (development)
4. `http://localhost:3001` (development)
5. All origins if `NODE_ENV === 'development'`

### Backend Environment Config (`backend/src/config/env.ts`)

**CORS Origin Default:**
```typescript
CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 
  process.env.CLOUDFLARE_PAGES_URL
    ? `https://${process.env.CLOUDFLARE_PAGES_URL}`
    : 'http://localhost:3000'),
```

## ⚠️ Potential Issues & Fixes

### Issue 1: CLOUDFLARE_PAGES_URL Format

**Problem:** The backend expects `CLOUDFLARE_PAGES_URL` to be just the domain (e.g., `your-project.pages.dev`), but it constructs the full URL. However, if the environment variable already contains `https://`, it will create `https://https://...`.

**Current Code:**
```typescript
...(process.env.CLOUDFLARE_PAGES_URL
  ? [`https://${process.env.CLOUDFLARE_PAGES_URL}`]
  : []),
```

**Fix Needed:** Handle both formats (with and without `https://`)

### Issue 2: CORS_ORIGIN Should Be Set Explicitly

**Problem:** Relying on `CLOUDFLARE_PAGES_URL` might not be reliable. It's better to set `CORS_ORIGIN` directly.

**Recommendation:** Set `CORS_ORIGIN` in backend environment variables to your Cloudflare Pages URL.

## 🔧 Recommended Configuration

### For Local Development

**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend (`.env`):**
```env
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### For Production (Cloudflare Pages + Railway Backend)

**Frontend (Cloudflare Pages Environment Variables):**
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Backend (Railway Environment Variables):**
```env
CORS_ORIGIN=https://your-project.pages.dev
# OR if you have multiple frontends:
CORS_ORIGIN=https://your-project.pages.dev,https://another-domain.com
```

## ✅ Communication Flow Verification

### 1. Authentication Flow

**Frontend → Backend:**
1. User submits login form
2. Frontend calls `POST ${API_URL}/api/auth/login`
3. Axios adds `Authorization: Bearer <token>` header (if token exists)
4. Backend validates CORS origin
5. Backend processes request
6. Backend returns tokens in response

**Backend → Frontend:**
1. Backend sends response with `accessToken` and `refreshToken`
2. Frontend stores tokens in `localStorage`
3. Frontend stores user data in Zustand store
4. Subsequent requests include token in `Authorization` header

### 2. API Request Flow

**Every API Request:**
1. Frontend: Axios interceptor adds `Authorization: Bearer <token>` from localStorage
2. Frontend: Request sent to `${API_URL}/api/...`
3. Backend: CORS middleware checks origin
4. Backend: Auth middleware validates token
5. Backend: Processes request and returns response
6. Frontend: Response interceptor handles errors (401 → redirect to login)

### 3. Error Handling

**401 Unauthorized:**
- Frontend interceptor detects 401
- Clears tokens from localStorage
- Redirects to `/login`

**CORS Error:**
- Browser blocks request
- Check backend `CORS_ORIGIN` includes frontend URL
- Check backend logs for CORS rejection

## 🧪 Testing Communication

### Test 1: Local Development

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   # Should start on http://localhost:3001
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Should start on http://localhost:3000
   ```

3. **Test API Connection:**
   - Open browser console
   - Navigate to http://localhost:3000
   - Check Network tab for API requests
   - Verify requests go to `http://localhost:3001/api/...`

### Test 2: Production (Cloudflare Pages)

1. **Check Frontend Environment Variable:**
   - Cloudflare Pages → Your Project → Settings → Environment Variables
   - Verify `NEXT_PUBLIC_API_URL` is set to your backend URL

2. **Check Backend CORS:**
   - Railway → Backend Service → Variables
   - Verify `CORS_ORIGIN` includes your Cloudflare Pages URL
   - Format: `https://your-project.pages.dev`

3. **Test in Browser:**
   - Open Cloudflare Pages URL
   - Open DevTools → Network tab
   - Try logging in
   - Check if requests succeed or fail with CORS errors

### Test 3: CORS Verification

**Test CORS with curl:**
```bash
# Test from your Cloudflare Pages domain
curl -H "Origin: https://your-project.pages.dev" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://your-backend.railway.app/api/auth/login

# Should return CORS headers:
# Access-Control-Allow-Origin: https://your-project.pages.dev
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

## 🔍 Debugging Communication Issues

### Issue: "Network Error" or "CORS Error"

**Symptoms:**
- Browser console shows CORS error
- Network tab shows OPTIONS request failed
- Request blocked by browser

**Solutions:**
1. Check backend `CORS_ORIGIN` includes frontend URL
2. Verify frontend URL matches exactly (including `https://`)
3. Check backend logs for CORS rejection messages
4. Ensure `credentials: true` is set (it is)

### Issue: "401 Unauthorized"

**Symptoms:**
- API requests return 401
- User gets logged out unexpectedly

**Solutions:**
1. Check token is stored in localStorage: `localStorage.getItem('accessToken')`
2. Verify token is added to requests (check Network tab → Headers → Authorization)
3. Check backend JWT_SECRET matches
4. Verify token hasn't expired

### Issue: "Cannot connect to API"

**Symptoms:**
- Network error in console
- Request fails immediately

**Solutions:**
1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Check backend is running and accessible
3. Test backend health endpoint: `curl https://your-backend.railway.app/health`
4. Check firewall/network restrictions

## 📋 Configuration Checklist

### Frontend (Cloudflare Pages)
- [ ] `NEXT_PUBLIC_API_URL` set to backend URL
- [ ] Build command: `npm run build:cloudflare`
- [ ] Root directory: `frontend`
- [ ] Output directory: `.vercel/output/static`

### Backend (Railway)
- [ ] `CORS_ORIGIN` includes Cloudflare Pages URL
- [ ] `CORS_ORIGIN` format: `https://your-project.pages.dev` (or comma-separated)
- [ ] Backend is accessible (test `/health` endpoint)
- [ ] All required environment variables set

## 🎯 Summary

**Current Status:** ✅ **Configuration looks correct**

**Frontend:**
- ✅ Properly configured to use `NEXT_PUBLIC_API_URL`
- ✅ Token authentication working
- ✅ Error handling in place

**Backend:**
- ✅ CORS configured to accept Cloudflare Pages origin
- ✅ Supports comma-separated origins
- ✅ Credentials enabled
- ✅ Proper headers allowed

**Action Items:**
1. Ensure `CORS_ORIGIN` is set in backend to your Cloudflare Pages URL
2. Ensure `NEXT_PUBLIC_API_URL` is set in Cloudflare Pages to your backend URL
3. Test the connection after deployment

**If issues persist:**
- Check browser console for specific error messages
- Check backend logs for CORS rejections
- Verify environment variables are set correctly in both platforms
