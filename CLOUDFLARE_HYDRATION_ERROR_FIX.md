# Fix React Error #300 (Hydration Mismatch) on Cloudflare Pages

## 🔴 Problem

You're seeing **React Error #300** - a hydration mismatch error. This occurs when the HTML rendered on the server doesn't match what React expects on the client.

## ✅ Root Cause

**Cloudflare's Auto Minify feature** is modifying your HTML during minification, which breaks React hydration in Next.js applications. Cloudflare minifies whitespace and HTML in ways that create mismatches between server-rendered and client-rendered HTML.

## 🛠️ Solution: Disable HTML Minification in Cloudflare

### For Cloudflare Pages (No Custom Domain)

If you're using Cloudflare Pages with the default `.pages.dev` subdomain (no custom domain):

#### Option 1: Via Cloudflare Pages Settings (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Pages**
3. Select your **QueryAI frontend project**
4. Go to **Settings** → **Builds & deployments**
5. Look for **"Environment Variables"** or **"Build settings"**
6. **Note:** HTML minification settings for Pages are typically controlled at the account level

#### Option 2: Via Account-Level Settings

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on your **account/profile** (top right)
3. Navigate to **Speed** → **Optimization** (if available for your account)
4. Or go to **Overview** → Find your account settings
5. Look for **"Auto Minify"** settings
6. **Uncheck the HTML checkbox** ✅

#### Option 3: Create a Custom Domain (Alternative)

If you have a domain, you can:
1. Add a custom domain to your Cloudflare Pages project
2. Then access domain-level settings as described below

### For Cloudflare Pages with Custom Domain

If you have a custom domain connected:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your **custom domain** (not the Pages project)
3. Navigate to **Speed** → **Optimization**
4. Scroll down to **"Content Optimization"** section
5. Find **"Auto Minify"**
6. **Uncheck the HTML checkbox** ✅
   - Keep JavaScript and CSS minification enabled if you want (they're usually fine)
   - Only HTML minification causes hydration issues

### Step 3: Purge Cloudflare Cache

**For Pages Projects:**
1. Go to **Workers & Pages** → **Pages** → Your Project
2. Go to **Deployments** tab
3. Click **"Retry deployment"** or **"Redeploy"** to trigger a fresh build
4. Or wait for the next automatic deployment

**For Custom Domains:**
1. Go to **Caching** → **Configuration**
2. Click **"Purge Cache"**
3. Select **"Purge Everything"**
4. Click **"Purge Everything"** to confirm

### Step 4: Wait and Test

1. Wait 1-2 minutes for changes to propagate
2. Hard refresh your Cloudflare Pages site (Ctrl+Shift+R or Cmd+Shift+R)
3. Test the application - the error should be resolved

## 📋 Alternative: Check for Other Hydration Issues

If disabling HTML minification doesn't fix it, check for these common causes:

### 1. Browser-Only APIs During Render

**Problem:** Using `localStorage`, `window`, or `document` during initial render.

**Current Code (Already Fixed):**
```typescript
// ✅ Good - Uses typeof window check
const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ragSettings');
    // ...
  }
  return defaultSettings;
});
```

### 2. Date/Time Differences

**Problem:** Using `new Date()` or `Date.now()` during render can cause mismatches.

**Solution:** Use `useEffect` to set date-dependent values after mount.

### 3. Random Values

**Problem:** Using `Math.random()` or generating IDs during render.

**Solution:** Generate random values in `useEffect` or use stable IDs.

### 4. Conditional Rendering Based on Client State

**Problem:** Rendering different content based on client-side state during SSR.

**Solution:** Use `useState` with a default that matches server render, then update in `useEffect`.

## 🔍 Verify the Fix

After disabling HTML minification:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** the page (Ctrl+Shift+R)
3. **Check browser console** - Error #300 should be gone
4. **Test functionality** - All features should work normally

## 🎯 Quick Reference

### For Cloudflare Pages (No Custom Domain):
**Settings Path:**
```
Dashboard → Workers & Pages → Pages → Your Project → Settings
```
**Note:** HTML minification may be controlled at account level or may not be applicable to Pages projects.

**Alternative:** Trigger a new deployment to clear cache:
```
Dashboard → Workers & Pages → Pages → Your Project → Deployments → Retry/Redeploy
```

### For Custom Domains:
**Settings Path:**
```
Dashboard → Your Domain → Speed → Optimization → Auto Minify → Uncheck HTML
```

**Cache Purge Path:**
```
Dashboard → Your Domain → Caching → Configuration → Purge Cache → Purge Everything
```

## ⚠️ Important Note for Pages Projects

**Cloudflare Pages projects** (using `.pages.dev` subdomain) may not have HTML minification enabled by default, or it may be controlled differently. If you can't find the HTML minify setting:

1. **Check if the issue is actually from Cloudflare minification** - The error might be from:
   - Build-time issues
   - Code-level hydration problems
   - Other Cloudflare optimizations

2. **Try these alternatives:**
   - Trigger a fresh deployment (retry the latest deployment)
   - Check Cloudflare Pages build logs for errors
   - Verify your Next.js build is correct
   - Check browser console for more specific error details

## 📚 Additional Resources

- [React Error #300 Documentation](https://react.dev/errors/300)
- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- [Cloudflare Next.js Troubleshooting](https://developers.cloudflare.com/pages/framework-guides/nextjs/ssr/troubleshooting)

## ✅ Expected Result

After following these steps:
- ✅ React Error #300 should disappear
- ✅ Application should load without hydration errors
- ✅ All features should work correctly
- ✅ No more "Something went wrong" error screen

## 🚨 If Issue Persists

If the error still occurs after disabling HTML minification:

1. **Check browser console** for the full error message
2. **Check Cloudflare build logs** for any build-time errors
3. **Verify Next.js version compatibility** with Cloudflare Pages
4. **Check for custom HTML modifications** in Cloudflare settings
5. **Review component code** for any browser-only API usage during render

---

**Note:** This is a known issue with Cloudflare's HTML minification and Next.js. Disabling HTML minification is the recommended solution and won't significantly impact performance (JavaScript and CSS minification can remain enabled).
