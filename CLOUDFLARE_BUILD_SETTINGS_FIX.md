# Cloudflare Pages Build Settings Fix

## 🔴 Problem Identified

Your Cloudflare Pages build settings show:
- **Build command:** `npx @cloudflare/next-on-pages@1` ❌ **WRONG**

But the correct command should be:
- **Build command:** `npm run build:cloudflare` ✅ **CORRECT**

## ⚠️ Why This Causes Issues

The current build command `npx @cloudflare/next-on-pages@1` is **missing the `next build` step**. This means:

1. ❌ Next.js application is **not being compiled** first
2. ❌ The adapter tries to process non-existent build output
3. ❌ Your subscription system code never gets built into the bundle
4. ❌ Changes appear in deployment logs but don't actually get compiled

The correct command `npm run build:cloudflare` runs:
```bash
next build && npx @cloudflare/next-on-pages@1.13.16
```

This:
1. ✅ Compiles Next.js application (`next build`)
2. ✅ Adapts output for Cloudflare Pages (`npx @cloudflare/next-on-pages@1.13.16`)
3. ✅ Includes all your latest code changes

## ✅ How to Fix

### Step 1: Update Cloudflare Pages Build Settings

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages**
2. Click on your **QueryAI** project
3. Go to **Settings** → **Builds & deployments**
4. Scroll to **Build configuration**
5. Update the **Build command** field:

   **Change from:**
   ```
   npx @cloudflare/next-on-pages@1
   ```

   **Change to:**
   ```
   npm run build:cloudflare
   ```

6. **Save** the changes

### Step 2: Verify Other Settings

Make sure these settings are correct:

- ✅ **Root directory:** `frontend`
- ✅ **Build command:** `npm run build:cloudflare`
- ✅ **Build output directory:** `.vercel/output/static`
- ✅ **Framework preset:** Next.js (or leave empty)

### Step 3: Verify Branch Configuration

1. In the same **Builds & deployments** section
2. Check **Production branch**:
   - Should be: `development` (or your main branch)
   - If it's set to `main` but you're pushing to `development`, change it

### Step 4: Trigger New Build

After updating settings:

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest deployment
3. OR click **Create deployment** → Select `development` branch → **Save and Deploy**

### Step 5: Verify Build Logs

After the new build, check the logs. You should see:

```
Executing user command: npm run build:cloudflare
> frontend@0.1.0 build:cloudflare
> next build && npx @cloudflare/next-on-pages@1.13.16
```

And then:
```
✓ Compiled successfully
✓ Generating static pages
⚡️ Build completed
```

## 📋 Complete Build Settings Checklist

Update your Cloudflare Pages settings to match:

| Setting | Value |
|---------|-------|
| **Root directory** | `frontend` |
| **Build command** | `npm run build:cloudflare` |
| **Build output directory** | `.vercel/output/static` |
| **Framework preset** | Next.js (or empty) |
| **Production branch** | `development` (or your main branch) |
| **Node.js version** | 22.x (or latest) |

## 🔍 Additional Issues to Check

### Issue 1: Wrong Branch

If your build logs show an old commit like:
```
HEAD is now at a107a71 Improve frontend-backend communication configuration
```

But subscription system was committed in `12e48da` or later, then:

1. Check **Production branch** is set to `development`
2. Verify all commits are pushed: `git log --oneline -5`
3. Trigger manual rebuild

### Issue 2: Environment Variables

Make sure `NEXT_PUBLIC_API_URL` is set:
1. **Settings** → **Environment Variables**
2. Verify `NEXT_PUBLIC_API_URL` exists
3. Value should be your Railway backend URL: `https://queryai-production.up.railway.app`

## ✅ Expected Result

After fixing the build command:

1. ✅ Build logs show `next build` running first
2. ✅ TypeScript compilation succeeds
3. ✅ All components (including subscription) are built
4. ✅ Subscription tab appears in sidebar
5. ✅ Analytics tab appears for premium/pro users

## 🚨 Most Critical Fix

**The build command MUST be:**
```
npm run build:cloudflare
```

**NOT:**
```
npx @cloudflare/next-on-pages@1
```

This is the #1 reason why your changes aren't appearing - the Next.js app isn't being built before the adapter runs!
