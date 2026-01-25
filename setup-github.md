# Setting Up GitHub Remote

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `QueryAI` (or your preferred name)
3. **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click "Create repository"

## Step 2: Add Remote and Push

After creating the repository, GitHub will show you commands. Use these commands instead (they include pushing both branches):

```bash
git remote add origin https://github.com/YOUR_USERNAME/QueryAI.git
git push -u origin main
git push -u origin development
```

Replace `YOUR_USERNAME` with your GitHub username.

## Step 3: Verify

Check that both branches are on GitHub:
- Main branch: `https://github.com/YOUR_USERNAME/QueryAI`
- Development branch: Switch branches on GitHub or check: `https://github.com/YOUR_USERNAME/QueryAI/tree/development`
