# Railway Build Fix - Dockerfile Error

## Problem

Railway build was failing with:
```
Build Failed: build daemon returned an error < failed to solve: dockerfile parse error on line 12: ENV names can not be blank >
```

Railway was trying to load a Dockerfile even though Nixpacks was configured.

## Solution Applied

1. **Created explicit Dockerfile** (`backend/Dockerfile`):
   - Valid Dockerfile to prevent Railway from auto-generating one
   - Railway should still use Nixpacks as configured in `railway.toml`

2. **Made Pesapal env vars optional**:
   - Updated `backend/src/config/env.ts` to make Pesapal variables optional
   - Prevents build failures when credentials aren't set

3. **Updated railway.toml**:
   - Explicitly set `buildCommand = "npm run build"`
   - Forces Railway to use Nixpacks builder

## If Build Still Fails

If Railway still tries to use Dockerfile instead of Nixpacks:

### Option 1: Remove Dockerfile and Force Nixpacks
1. Delete `backend/Dockerfile`
2. In Railway Dashboard → Settings → Build:
   - Set **Builder** to **Nixpacks** explicitly
   - Ensure **Build Command** is `npm run build`

### Option 2: Use Dockerfile (if Nixpacks doesn't work)
If Railway insists on using Dockerfile, the current Dockerfile should work. It follows the same steps as Nixpacks:
- Uses Node.js 20
- Runs `npm ci` to install
- Runs `npm run build` to build
- Runs `npm start` to start

## Verification

After deployment, check:
- ✅ Build completes successfully
- ✅ Application starts correctly
- ✅ Health check endpoint responds (`/health`)
- ✅ API endpoints are accessible

## Current Configuration

- **Builder**: Nixpacks (configured in `railway.toml`)
- **Build Command**: `npm run build` (from `nixpacks.toml`)
- **Start Command**: `npm start` (from `railway.toml`)
- **Dockerfile**: Exists as fallback (should not be used if Nixpacks works)
