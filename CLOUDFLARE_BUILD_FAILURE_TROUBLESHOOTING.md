# Cloudflare Pages Build Failure Troubleshooting

## 🔴 Build Failed with `npm run build:cloudflare`

If your build is failing after updating the build command, follow these steps:

## Step 1: Check Build Logs

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages** → Your Project
2. Click on the **failed deployment**
3. Click **View build log** or **View details**
4. Scroll through the logs to find the **error message**

Common error patterns to look for:
- `npm ERR!` - Dependency installation issues
- `Type error:` - TypeScript compilation errors
- `Error:` - Build process errors
- `Command failed with exit code 1` - General build failure

## Step 2: Common Fixes

### Fix 1: Install Dependencies First

Cloudflare Pages should auto-install dependencies, but sometimes it doesn't. Try this build command:

**Option A: Explicit Install (Recommended)**
```
npm ci && npm run build:cloudflare
```

**Option B: Install then Build Separately**
```
npm install && next build && npx @cloudflare/next-on-pages@1.13.16
```

### Fix 2: Use Cloudflare's Recommended Command

According to Cloudflare docs, try this simpler command:

```
npx @cloudflare/next-on-pages@1
```

**Note:** This should auto-detect and run `next build` first, but verify in logs.

### Fix 3: Add @cloudflare/next-on-pages as Dependency

If `npx` is failing to download the package, add it to `package.json`:

1. Add to `devDependencies` in `frontend/package.json`:
```json
"devDependencies": {
  "@cloudflare/next-on-pages": "^1.13.16",
  ...
}
```

2. Then use build command:
```
npm ci && npm run build:cloudflare
```

### Fix 4: Check Node.js Version

Cloudflare Pages might be using an incompatible Node.js version:

1. Go to **Settings** → **Builds & deployments**
2. Check **Node.js version** (should be 18.x or 20.x)
3. If not set, add environment variable: `NODE_VERSION=20`

### Fix 5: Verify Root Directory

Make sure **Root directory** is set to:
```
frontend
```

Not:
```
/frontend
```
(No leading slash)

## Step 3: Alternative Build Commands to Try

Try these in order until one works:

### Option 1: Full Install + Build
```
npm ci && npm run build:cloudflare
```

### Option 2: Simple Cloudflare Command
```
npx @cloudflare/next-on-pages@1
```

### Option 3: Explicit Next Build
```
npm install && next build && npx @cloudflare/next-on-pages@1.13.16
```

### Option 4: With Node Version
```
NODE_VERSION=20 npm ci && npm run build:cloudflare
```

## Step 4: Check for TypeScript Errors

If the build fails with TypeScript errors:

1. **Test locally first:**
   ```bash
   cd frontend
   npm install
   npm run build:cloudflare
   ```

2. **Fix any TypeScript errors** that appear locally
3. **Commit and push** the fixes
4. **Retry deployment**

## Step 5: Verify Environment Variables

Some builds fail if required environment variables are missing:

1. Go to **Settings** → **Environment Variables**
2. Ensure `NEXT_PUBLIC_API_URL` is set
3. Add it for **Production** environment (not just Preview)

## Step 6: Check Package.json Scripts

Verify your `frontend/package.json` has:
```json
{
  "scripts": {
    "build:cloudflare": "next build && npx @cloudflare/next-on-pages@1.13.16"
  }
}
```

## Step 7: Review Build Output Directory

Make sure **Build output directory** is:
```
.vercel/output/static
```

Not:
```
./.vercel/output/static
```
(No leading `./`)

## 🔍 Debugging Checklist

- [ ] Build logs show specific error message
- [ ] Dependencies install successfully (`npm install` or `npm ci`)
- [ ] `next build` completes without errors
- [ ] `@cloudflare/next-on-pages` runs successfully
- [ ] Output directory `.vercel/output/static` exists after build
- [ ] Root directory is `frontend` (no leading slash)
- [ ] Node.js version is 18.x or 20.x
- [ ] Environment variables are set correctly
- [ ] No TypeScript errors in local build

## 📋 Quick Fix Summary

**Most likely fixes (try in order):**

1. **Change build command to:**
   ```
   npm ci && npm run build:cloudflare
   ```

2. **Or try Cloudflare's simple command:**
   ```
   npx @cloudflare/next-on-pages@1
   ```

3. **Add @cloudflare/next-on-pages to devDependencies** and use:
   ```
   npm ci && npm run build:cloudflare
   ```

4. **Check Node.js version** is 18+ or 20+

## 🚨 If Still Failing

1. **Share the build logs** - The specific error message will help identify the issue
2. **Test locally** - Run `npm run build:cloudflare` in the `frontend` directory
3. **Check for recent changes** - Did any recent commits break the build?
4. **Verify Git branch** - Is Cloudflare building from the correct branch?

## ✅ Expected Successful Build Log

A successful build should show:
```
✓ Installing dependencies
✓ Running build command
✓ Compiled successfully
✓ Generating static pages
✓ Build completed
✓ Uploading files to Cloudflare
```
