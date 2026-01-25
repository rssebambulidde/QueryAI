# Railway Troubleshooting Guide

## Common Issues and Solutions

---

## Issue: "directory /backend does not exist" Error

**Error Message:**
```
ERRO error creating app: directory /build-sessions/.../snapshot-target-unpack/backend does not exist
```

### Solution 1: Push Code to GitHub

Railway deploys from GitHub, so your code must be pushed first.

**Check if code is pushed:**
```bash
git status
```

**If you see "Your branch is ahead of 'origin/development'":**
```bash
# Push your commits
git push origin development
```

**Verify backend folder is in GitHub:**
- Go to your GitHub repository
- Check that `backend/` folder exists
- Verify `backend/package.json` is visible

### Solution 2: Check Root Directory Setting

1. Go to Railway Dashboard
2. Click on your service
3. Go to **Settings** tab
4. Scroll to **Root Directory**
5. Set it to: `backend`
6. Save and redeploy

### Solution 3: Verify Branch Connection

1. Railway Dashboard → Your Service → **Settings**
2. Check **Source** section
3. Ensure it's connected to the correct branch (`development` or `main`)
4. If wrong, disconnect and reconnect to the correct branch

---

## Issue: Build Fails - TypeScript Errors

**Error:** TypeScript compilation errors during build

**Solution:**
1. Test build locally first:
   ```bash
   cd backend
   npm run build
   ```
2. Fix any TypeScript errors
3. Commit and push changes
4. Railway will automatically redeploy

---

## Issue: Server Won't Start

**Error:** Server fails to start after successful build

### Check 1: Environment Variables
- Verify all required variables are set in Railway
- Check for typos in variable names
- Ensure no extra spaces in values

### Check 2: Port Configuration
- Railway automatically provides `PORT`
- Don't set `PORT` manually in Railway
- Server should use `process.env.PORT`

### Check 3: Logs
- Check Railway logs for specific error messages
- Look for missing environment variables
- Check for runtime errors

---

## Issue: Health Check Fails

**Error:** `/health` endpoint returns error or timeout

**Solution:**
1. Verify server is listening on the correct port
2. Check that `/health` route is defined in `server.ts`
3. Ensure server starts successfully (check logs)
4. Health check timeout is 100ms - ensure response is fast

---

## Issue: CORS Errors

**Error:** CORS policy blocking requests

**Solution:**
1. Set `CORS_ORIGIN` in Railway variables
2. Use your frontend domain (e.g., `https://your-frontend.railway.app`)
3. Or leave empty to auto-detect Railway domain
4. For development, you can temporarily use `*` (not recommended for production)

---

## Issue: Environment Variables Not Loading

**Symptoms:** Server can't find required environment variables

**Solution:**
1. Verify variables are set in Railway Dashboard → Variables
2. Check variable names match exactly (case-sensitive)
3. Ensure no leading/trailing spaces
4. Redeploy after adding variables

---

## Issue: Build Takes Too Long

**Solution:**
1. Check `.railwayignore` - exclude unnecessary files
2. Ensure `node_modules` is in `.gitignore` (Railway installs fresh)
3. Check build logs for slow operations
4. Consider using Railway's caching

---

## Issue: "Module not found" Errors

**Error:** Cannot find module 'xxx'

**Solution:**
1. Verify all dependencies are in `package.json`
2. Check `package-lock.json` is committed
3. Ensure no missing `devDependencies` that are needed at runtime
4. Rebuild: Railway will run `npm install` automatically

---

## Quick Fixes Checklist

When deployment fails:

- [ ] **Code pushed to GitHub?** → `git push origin development`
- [ ] **Root directory set correctly?** → Should be `backend`
- [ ] **Branch connected?** → Check Railway settings
- [ ] **Environment variables set?** → Check Railway Variables tab
- [ ] **Build works locally?** → Run `npm run build` in backend folder
- [ ] **Server starts locally?** → Run `npm start` in backend folder
- [ ] **Check Railway logs** → Look for specific error messages

---

## Railway Configuration Verification

### Correct Setup:
```
Repository: github.com/rssebambulidde/QueryAI
Branch: development (or main)
Root Directory: backend
Build Command: (auto-detected) npm run build
Start Command: (auto-detected) npm start
```

### Verify in Railway:
1. Service → **Settings** → **Source**
   - Repository: `rssebambulidde/QueryAI`
   - Branch: `development`
   - Root Directory: `backend`

2. Service → **Variables**
   - All required variables present
   - No typos in names
   - Values are correct

---

## Getting Help

1. **Check Railway Logs:**
   - Service → **Logs** tab
   - Look for error messages
   - Check both Build Logs and Deploy Logs

2. **Test Locally:**
   ```bash
   cd backend
   npm install
   npm run build
   npm start
   ```

3. **Railway Support:**
   - Railway Dashboard → Help
   - Railway Discord: [discord.gg/railway](https://discord.gg/railway)
   - Railway Docs: [docs.railway.app](https://docs.railway.app)

---

## Common Railway Commands (CLI)

```bash
# View logs
railway logs

# Check status
railway status

# View variables
railway variables

# Redeploy
railway up

# Open dashboard
railway open
```

---

**Still having issues?** Check the logs, test locally, and verify all configuration matches this guide!
