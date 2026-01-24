# Cloudflare Pages Deployment Configuration

This document outlines the Cloudflare-only deployment configuration for QueryAI.

## ✅ Configuration Status

All deployment files have been configured exclusively for Cloudflare Pages.

### Removed Files (Railway-specific)

The following Railway-specific deployment files have been removed:
- ❌ `frontend/railway.json` - Railway frontend configuration
- ❌ `frontend/nixpacks.toml` - Railway build configuration
- ❌ `frontend/railpack.json` - Railway pack configuration
- ❌ `backend/railway.json` - Railway backend configuration

### Active Configuration Files

#### Frontend (Cloudflare Pages)

1. **`frontend/wrangler.jsonc`** - Cloudflare Pages configuration
   ```jsonc
   {
     "$schema": "node_modules/wrangler/config-schema.json",
     "name": "queryai-frontend",
     "pages_build_output_dir": ".vercel/output/static",
     "compatibility_date": "2024-12-30",
     "compatibility_flags": ["nodejs_compat"]
   }
   ```
   - Output directory: `.vercel/output/static` (correct for `@cloudflare/next-on-pages`)
   - Node.js compatibility enabled for Cloudflare Workers/Pages

2. **`frontend/next.config.ts`** - Next.js configuration
   - Configured for Cloudflare Pages compatibility
   - Adapter handled by `@cloudflare/next-on-pages`

3. **`frontend/package.json`** - Build scripts
   - `build:cloudflare`: `next build && npx @cloudflare/next-on-pages@1.13.16`
   - This is the command used by Cloudflare Pages

#### Backend (Platform-agnostic)

The backend has been updated to remove Railway-specific hardcoding:

1. **`backend/src/server.ts`**
   - Removed Railway-specific proxy trust comments
   - Removed Railway-specific CORS origins
   - Now uses `CLOUDFLARE_PAGES_URL` environment variable for CORS

2. **`backend/src/config/env.ts`**
   - Removed Railway-specific default values
   - Removed `RAILWAY_PUBLIC_DOMAIN` and `RAILWAY_ENVIRONMENT` references
   - Now uses `CLOUDFLARE_PAGES_URL` for CORS origin defaults

## 🚀 Cloudflare Pages Deployment

### Build Configuration

**Build Command:**
```bash
npm run build:cloudflare
```

**Build Output Directory:**
```
.vercel/output/static
```

**Root Directory (if frontend is in subdirectory):**
```
frontend
```

### Environment Variables

Set these in Cloudflare Pages dashboard:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://your-backend.railway.app` |
| `NODE_ENV` | Environment | `production` |

### Backend CORS Configuration

The backend needs to allow your Cloudflare Pages domain. Set in backend environment variables:

```env
CORS_ORIGIN=https://your-project.pages.dev
```

Or set `CLOUDFLARE_PAGES_URL` in backend:
```env
CLOUDFLARE_PAGES_URL=your-project.pages.dev
```

## 📝 Updated Documentation

- ✅ `frontend/README.md` - Updated with Cloudflare Pages deployment instructions
- ✅ `frontend/QUICKSTART.md` - Removed Railway references

## 🔄 Migration Notes

### What Changed

1. **Removed Railway-specific files** - All Railway deployment configs deleted
2. **Backend CORS** - Now uses `CLOUDFLARE_PAGES_URL` instead of Railway variables
3. **Backend config** - Removed Railway-specific defaults, now platform-agnostic
4. **Documentation** - Updated to focus on Cloudflare Pages deployment

### Backward Compatibility

The backend still works with Railway (or any Node.js hosting) but no longer has Railway-specific hardcoding. You can:
- Deploy backend to Railway, Railway, or any Node.js platform
- Set `CORS_ORIGIN` environment variable to your Cloudflare Pages URL
- The backend will automatically allow requests from the configured origins

## ✅ Verification Checklist

- [x] Railway deployment files removed
- [x] `wrangler.jsonc` configured for Cloudflare Pages
- [x] `next.config.ts` configured for Cloudflare compatibility
- [x] Build script uses `build:cloudflare`
- [x] Backend CORS updated to use Cloudflare URL
- [x] Backend config removed Railway-specific defaults
- [x] Documentation updated

## 🎯 Next Steps

1. **Verify Cloudflare Pages Build:**
   - Push changes to GitHub
   - Check Cloudflare Pages build logs
   - Ensure build completes successfully

2. **Configure Environment Variables:**
   - Set `NEXT_PUBLIC_API_URL` in Cloudflare Pages
   - Set `CORS_ORIGIN` in backend to match Cloudflare Pages URL

3. **Test Deployment:**
   - Verify frontend loads correctly
   - Test API connectivity
   - Verify CORS is working

## 📚 References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
