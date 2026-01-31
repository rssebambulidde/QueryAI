# Git Push Script
# Run this in PowerShell to push all changes

Write-Host "Removing git lock file..." -ForegroundColor Yellow
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force -ErrorAction SilentlyContinue
    Write-Host "Lock file removed." -ForegroundColor Green
} else {
    Write-Host "No lock file found." -ForegroundColor Green
}

Write-Host "`nStaging all changes..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host "Files staged successfully." -ForegroundColor Green
} else {
    Write-Host "Error staging files. Make sure no other git processes are running." -ForegroundColor Red
    exit 1
}

Write-Host "`nCommitting changes..." -ForegroundColor Yellow
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

if ($LASTEXITCODE -eq 0) {
    Write-Host "Changes committed successfully." -ForegroundColor Green
} else {
    Write-Host "Error committing. Check if there are changes to commit." -ForegroundColor Red
    exit 1
}

Write-Host "`nPushing to origin/development..." -ForegroundColor Yellow
git push origin development

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully pushed to origin/development!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Error pushing. Check your git credentials and network connection." -ForegroundColor Red
    exit 1
}
