# Push stored status changes to repository
cd C:\Users\user\Desktop\QueryAI

Write-Host "Adding files..." -ForegroundColor Yellow
git add backend/src/routes/documents.routes.ts
git add backend/src/services/document.service.ts
git add backend/src/types/database.ts
git add backend/src/database/migrations/005_add_stored_status.sql
git add frontend/lib/api.ts
git add frontend/components/documents/document-manager.tsx
git add STORED_STATUS_FIX.md

Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "Fix: Add stored status for uploaded documents - Add stored status to database schema - Set default status to stored for new uploads - Update UI to show Process button for stored documents - Disable View/Download for stored/processing documents - Add migration script 005_add_stored_status.sql - Fix upload response to return correct status"

Write-Host "Pushing to repository..." -ForegroundColor Yellow
git push origin development

Write-Host "Done!" -ForegroundColor Green
