# Manual Push Instructions

Due to git lock file issues, please run these commands manually in your terminal.

## Option 1: Use the PowerShell Script

1. Open PowerShell in the project directory
2. Run:
   ```powershell
   .\push-changes.ps1
   ```

## Option 2: Manual Commands

### Step 1: Close All Git Processes
- Close VS Code (if Git panel is open)
- Close GitHub Desktop
- Close any other Git GUI tools
- Wait a few seconds

### Step 2: Remove Lock File
```powershell
Remove-Item -Path ".git/index.lock" -Force -ErrorAction SilentlyContinue
```

### Step 3: Stage Changes
```bash
git add .
```

### Step 4: Commit
```bash
git commit -m "Fix: Add role field to login/signup responses and implement admin/super_admin RBAC

- Add role field to AuthResponse interface
- Update login/signup methods to return role from profile
- Add debug logging for role in auth store
- Implement admin/super_admin role-based access control
- Add role field to user_profiles table (migration)
- Create authorization middleware (requireAdmin, requireSuperAdmin)
- Protect admin routes (analytics, metrics) with role checks
- Update frontend sidebar to use role-based visibility
- Create admin UI for user management (super_admin only)
- Update all admin pages to use role checks
- Remove Tavily branding from frontend
- Add comprehensive documentation and troubleshooting guides"
```

### Step 5: Push
```bash
git push origin development
```

## If Lock File Persists

1. **Check for running git processes:**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*git*"}
   ```
   Kill any git processes if found

2. **Try using Git Bash instead of PowerShell**

3. **Restart your computer** (if nothing else works)

## Files Ready to Push

**Modified (17 files):**
- backend/src/services/auth.service.ts ⚠️ **CRITICAL FIX**
- backend/src/routes/auth.routes.ts
- backend/src/routes/analytics.routes.ts
- backend/src/routes/metrics.routes.ts
- backend/src/server.ts
- backend/src/types/database.ts
- backend/src/types/user.ts
- frontend/app/dashboard/*.tsx (5 files)
- frontend/components/sidebar/app-sidebar.tsx
- frontend/components/usage/usage-display.tsx
- frontend/lib/api.ts
- frontend/lib/store/auth-store.ts

**New Files (11 files):**
- backend/src/database/migrations/030_add_user_roles.sql
- backend/src/middleware/authorization.middleware.ts
- backend/src/routes/admin.routes.ts
- backend/src/scripts/set-user-role.ts
- frontend/app/dashboard/admin/users/page.tsx
- frontend/components/admin/admin-guard.tsx
- frontend/components/admin/admin-only.tsx
- frontend/lib/hooks/use-user-role.ts
- frontend/components/debug/role-debug.tsx
- Documentation files (6 .md files)

## After Pushing

**IMPORTANT:** Restart your backend server so the role fix takes effect!

The critical fix is in `backend/src/services/auth.service.ts` - it now returns the `role` field in login/signup responses.
