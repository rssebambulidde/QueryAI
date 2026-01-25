# Cloudflare Pages Next.js 16 Compatibility Fix

## 🔴 Problem

The build is failing with this error:
```
npm error Could not resolve dependency:
npm error peer next@">=14.3.0 && <=15.5.2" from @cloudflare/next-on-pages@1.13.16
npm error Found: next@16.1.1
```

**Root Cause:** `@cloudflare/next-on-pages@1.13.16` only supports Next.js 13-15, but your project uses Next.js 16.1.1.

**Additional Issue:** `@cloudflare/next-on-pages` is **deprecated and archived** as of September 2025. Cloudflare recommends migrating to OpenNext adapter.

## ✅ Solution 1: Use Legacy Peer Deps (Quick Fix)

Update your Cloudflare Pages build command to use `--legacy-peer-deps`:

### Cloudflare Pages Build Settings

**Build command:**
```
npm install --legacy-peer-deps && npm run build:cloudflare
```

This will:
1. Install dependencies ignoring peer dependency conflicts
2. Run the build with the adapter

### Alternative: Update package.json

I've added an `overrides` section to `package.json` to force npm to accept the version mismatch. This should work with the standard build command:

**Build command:**
```
npm ci && npm run build:cloudflare
```

## ✅ Solution 2: Migrate to OpenNext (Recommended Long-term)

For a better long-term solution, consider migrating to the OpenNext adapter which supports Next.js 16:

1. **Install OpenNext:**
   ```bash
   npm install --save-dev @opennextjs/cloudflare
   ```

2. **Update build script:**
   ```json
   "build:cloudflare": "next build && npx @opennextjs/cloudflare"
   ```

3. **Update wrangler.jsonc:**
   ```jsonc
   {
     "pages_build_output_dir": ".opennext",
     // ... other config
   }
   ```

**Note:** This requires more testing and configuration changes. Use Solution 1 for now.

## 📋 Updated Cloudflare Pages Settings

After applying the fix, use these settings:

| Setting | Value |
|---------|-------|
| **Root directory** | `frontend` |
| **Build command** | `npm install --legacy-peer-deps && npm run build:cloudflare` |
| **Build output directory** | `.vercel/output/static` |
| **Framework preset** | Next.js (or empty) |

## ⚠️ Important Notes

1. **`--legacy-peer-deps`** bypasses peer dependency checks. This is safe for this use case since `@cloudflare/next-on-pages` should work with Next.js 16 despite the peer dependency warning.

2. **Package Override:** I've added an `overrides` section to `package.json` which tells npm to ignore the peer dependency conflict. This is a cleaner solution than using `--legacy-peer-deps` in the build command.

3. **Future Migration:** Consider migrating to OpenNext adapter (`@opennextjs/cloudflare`) in the future as `@cloudflare/next-on-pages` is deprecated.

## 🔄 Testing

After updating the build command:

1. **Trigger a new deployment** in Cloudflare Pages
2. **Check build logs** - should see successful installation and build
3. **Verify the site** loads correctly

## ✅ Expected Build Log

A successful build should show:
```
✓ Installing dependencies (with --legacy-peer-deps)
✓ Running next build
✓ Compiled successfully
✓ Running @cloudflare/next-on-pages
✓ Build completed
```

## 🚨 If Still Failing

If the build still fails:

1. **Try the package.json override approach** (already added)
2. **Use explicit version:** `npm install --legacy-peer-deps && next build && npx @cloudflare/next-on-pages@1.13.16`
3. **Check for other dependency conflicts** in build logs
4. **Consider downgrading Next.js to 15.x** (not recommended, but as last resort)
