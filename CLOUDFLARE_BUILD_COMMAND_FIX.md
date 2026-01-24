# Cloudflare Pages Build Command Fix

## 🔴 Issue: Build Failed with `npm run build:cloudflare`

## ✅ Solution: Updated Build Configuration

I've made two changes to fix the build:

### Change 1: Added @cloudflare/next-on-pages as Dependency

Added `@cloudflare/next-on-pages` to `devDependencies` in `package.json` so it's installed during `npm install`.

### Change 2: Updated Build Command

**Update your Cloudflare Pages build command to:**

```
npm ci && npm run build:cloudflare
```

This ensures:
1. ✅ Dependencies are installed first (`npm ci`)
2. ✅ Then the build runs (`npm run build:cloudflare`)

## 📋 Updated Cloudflare Pages Settings

Update these settings in Cloudflare Dashboard:

| Setting | Value |
|---------|-------|
| **Root directory** | `frontend` |
| **Build command** | `npm ci && npm run build:cloudflare` |
| **Build output directory** | `.vercel/output/static` |
| **Framework preset** | Next.js (or empty) |

## 🔄 Alternative Build Commands (if above doesn't work)

Try these in order:

### Option 1: With npm install
```
npm install && npm run build:cloudflare
```

### Option 2: Simple Cloudflare Command
```
npx @cloudflare/next-on-pages@1
```

### Option 3: Explicit Steps
```
npm ci && next build && npx @cloudflare/next-on-pages
```

## 🚨 Important Notes

1. **After updating build command**, trigger a new deployment
2. **Check build logs** for specific error messages if it still fails
3. **Verify Node.js version** is 18+ or 20+ in Cloudflare settings

## 📝 What Changed

- ✅ Added `@cloudflare/next-on-pages` to `devDependencies`
- ✅ Updated build script to use `npx @cloudflare/next-on-pages` (without version, uses installed version)
- ✅ Recommended build command: `npm ci && npm run build:cloudflare`

## ✅ Next Steps

1. **Commit and push** the updated `package.json`
2. **Update Cloudflare Pages** build command to: `npm ci && npm run build:cloudflare`
3. **Trigger new deployment**
4. **Check build logs** to verify success
