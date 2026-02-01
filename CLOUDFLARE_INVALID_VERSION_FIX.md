# Fix: "npm error Invalid Version:" on Cloudflare Pages

## Problem

Build fails during dependency install with:
```
npm error Invalid Version: 
Failed: build command exited with code 1
```

This happens because Cloudflare runs **npm clean-install** (npm ci) by default. With **lockfileVersion 3**, npm ci can hit a bug where the root package key is treated as a version and causes "Invalid Version".

## Solution

Skip Cloudflare’s automatic install and run **npm install** in your build command instead.

### Steps

1. **Cloudflare Dashboard** → **Workers & Pages** → Your QueryAI project.
2. **Settings** → **Builds & deployments**.
3. **Environment variables** → **Add variable**:
   - **Variable name:** `SKIP_DEPENDENCY_INSTALL`
   - **Value:** `1`
   - **Environment:** Production (and Preview if you use it).
4. **Build configuration** → **Build command**, set to:
   ```
   npm install && npm run build:cloudflare
   ```
5. **Save** and trigger a new deployment (e.g. **Retry deployment** or push a commit).

### Keep these settings

- **Root directory:** `frontend`
- **Build output directory:** `.vercel/output/static`

After this, the build uses `npm install` instead of `npm ci`, which avoids the Invalid Version error while still installing from `package-lock.json`.
