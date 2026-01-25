# PowerShell script to push QueryAI repository to GitHub
# Run this after creating the repository on GitHub

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$RepoName = "QueryAI"
)

$remoteUrl = "https://github.com/$GitHubUsername/$RepoName.git"

Write-Host "Setting up GitHub remote..." -ForegroundColor Green
git remote add origin $remoteUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host "Remote added successfully!" -ForegroundColor Green
} else {
    Write-Host "Remote might already exist. Checking..." -ForegroundColor Yellow
    git remote set-url origin $remoteUrl
}

Write-Host "Pushing main branch..." -ForegroundColor Green
git checkout main
git push -u origin main

Write-Host "Pushing development branch..." -ForegroundColor Green
git checkout development
git push -u origin development

Write-Host "Switching back to main branch..." -ForegroundColor Green
git checkout main

Write-Host "Done! Your repository is now on GitHub." -ForegroundColor Green
Write-Host "Repository URL: $remoteUrl" -ForegroundColor Cyan
