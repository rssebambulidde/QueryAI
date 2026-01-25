# Frontend Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment

Create `.env.local` file:

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` and set your API URL:

```env
# For local development (backend running on port 3001)
NEXT_PUBLIC_API_URL=http://localhost:3001

# For production (your backend API URL)
# NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

### Step 3: Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

---

## 🧪 Testing Authentication

### Test Signup

1. Navigate to: http://localhost:3000/signup
2. Fill in the form:
   - Email: `test@example.com`
   - Password: `test123456` (min 8 characters)
   - Full Name: (optional)
3. Click "Create account"
4. You should be redirected to the dashboard

### Test Login

1. Navigate to: http://localhost:3000/login
2. Enter your credentials
3. Click "Sign in"
4. You should be redirected to the dashboard

### Test Password Reset

1. Navigate to: http://localhost:3000/forgot-password
2. Enter your email
3. Click "Send reset link"
4. Check your email for the reset link

### Test Dashboard

1. After logging in, you'll see the dashboard
2. Your user information is displayed
3. Click "Logout" to sign out

---

## 🔧 Troubleshooting

### "Cannot connect to API"

**Problem:** Frontend can't reach the backend

**Solution:**
1. Make sure backend is running on port 3001
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Verify CORS is configured in backend

### "401 Unauthorized"

**Problem:** Token expired or invalid

**Solution:**
1. Clear browser localStorage
2. Log in again
3. Check backend logs for auth errors

### "Network Error"

**Problem:** CORS or connection issue

**Solution:**
1. Check backend CORS settings
2. Verify API URL is correct
3. Check browser console for errors

---

## 📁 Project Structure

```
frontend/
├── app/                    # Pages
│   ├── login/             # Login page
│   ├── signup/           # Signup page
│   ├── forgot-password/  # Password reset
│   ├── dashboard/         # Protected dashboard
│   └── page.tsx          # Home page
├── components/           # React components
│   └── ui/              # UI components
├── lib/                 # Utilities
│   ├── api.ts          # API client
│   └── store/         # Zustand stores
└── .env.local          # Environment variables
```

---

## 🎯 Next Steps

1. ✅ Test all authentication flows
2. ✅ Verify API integration
3. ⏳ Add chat interface
4. ⏳ Add document upload
5. ⏳ Add AI query interface

---

## 📚 More Information

See `README.md` for detailed documentation.
