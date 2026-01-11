# Railway Quick Start Checklist

Quick reference for deploying to Railway. See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed guide.

## ✅ Pre-Deployment Checklist

- [ ] Code pushed to GitHub repository
- [ ] Railway account created
- [ ] All API keys collected (Supabase, OpenAI, etc.)
- [ ] Environment variables ready

## 🚀 Deployment Steps

### 1. Create Railway Project
- [ ] Go to [railway.app/dashboard](https://railway.app/dashboard)
- [ ] Click **"New Project"**
- [ ] Select **"Deploy from GitHub repo"**
- [ ] Choose `QueryAI` repository
- [ ] Set **Root Directory** to: `backend`

### 2. Configure Environment Variables
Add these in Railway Dashboard → Service → Variables:

**Required:**
- [ ] `NODE_ENV=development`
- [ ] `SUPABASE_URL=...`
- [ ] `SUPABASE_ANON_KEY=...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=...`
- [ ] `OPENAI_API_KEY=sk-...`
- [ ] `JWT_SECRET=...` (generate secure random string)
- [ ] `CORS_ORIGIN=...` (or leave empty for Railway auto-detect)

**Optional (for later phases):**
- [ ] `ANTHROPIC_API_KEY=...`
- [ ] `TAVILY_API_KEY=...`
- [ ] `PINECONE_API_KEY=...`
- [ ] `PINECONE_ENVIRONMENT=...`
- [ ] `PINECONE_INDEX_NAME=queryai-embeddings`

**Note:** Railway automatically provides:
- ✅ `PORT` (don't set manually)
- ✅ `RAILWAY_PUBLIC_DOMAIN` (auto-provided)
- ✅ `RAILWAY_ENVIRONMENT` (auto-provided)

### 3. Deploy
- [ ] Railway auto-detects Node.js project
- [ ] Build runs automatically (`npm run build`)
- [ ] Server starts automatically (`npm start`)
- [ ] Watch deployment logs in Railway dashboard

### 4. Verify Deployment
- [ ] Get Railway URL from dashboard
- [ ] Test health endpoint: `https://your-app.railway.app/health`
- [ ] Test API endpoint: `https://your-app.railway.app/api`
- [ ] Check logs for any errors

## 🔧 Railway Commands (CLI)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Set environment variable
railway variables set OPENAI_API_KEY=sk-...

# View logs
railway logs

# Open dashboard
railway open
```

## 🐛 Common Issues

### Build Fails
- Check TypeScript compilation errors
- Verify all dependencies in `package.json`
- Check Railway build logs

### Server Won't Start
- Check environment variables are set
- Verify `JWT_SECRET` is set (required)
- Check Railway logs for errors

### Health Check Fails
- Ensure `/health` endpoint responds
- Check server is listening on provided PORT
- Verify no errors in logs

### CORS Errors
- Set `CORS_ORIGIN` to your frontend domain
- Or leave empty to auto-detect Railway domain
- Check CORS configuration in logs

## 📝 Notes

- Railway automatically handles `PORT` - don't set it manually
- Build runs via `postinstall` script in `package.json`
- Logs are available in Railway dashboard
- Railway provides HTTPS automatically
- Custom domains available in Railway settings

## 🔗 Useful Links

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs](https://docs.railway.app)
- [Full Deployment Guide](./RAILWAY_DEPLOYMENT.md)

---

**Ready to deploy?** Follow the steps above and refer to the full guide if you encounter any issues!
