# Railway Deployment Guide

This guide walks you through deploying the QueryAI backend to Railway in a development environment.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Environment Variables**: Collect all required API keys and secrets

## Step 1: Create New Project on Railway

1. Log in to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `QueryAI` repository
5. Railway will detect it's a Node.js project

## Step 2: Configure Deployment Settings

### Root Directory
- Set **Root Directory** to: `backend`
- This tells Railway where your backend code is located

### Build Command
- Railway will automatically detect `npm run build` from `package.json`
- Or use the build command: `npm run build`

### Start Command
- Railway will automatically detect `npm start` from `package.json`
- Or use: `npm start`

## Step 3: Configure Environment Variables

Click on your service → **Variables** tab → Add the following environment variables:

### Required Variables

```env
# Server Configuration
NODE_ENV=development
API_BASE_URL=https://your-app.railway.app

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Services
OPENAI_API_KEY=sk-...

# Authentication
JWT_SECRET=your-secure-random-secret-key-here
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
# Or use Railway's domain: https://your-app.railway.app

# Logging
LOG_LEVEL=info
```

### Optional Variables (for later phases)

```env
# AI Services (Optional)
ANTHROPIC_API_KEY=sk-ant-...

# Search API (Optional)
TAVILY_API_KEY=tvly-...

# Vector Database (Optional)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=queryai-embeddings
```

### Railway Automatic Variables

Railway automatically provides:
- `PORT` - Server port (don't set manually)
- `RAILWAY_PUBLIC_DOMAIN` - Your app's public domain
- `RAILWAY_ENVIRONMENT` - Environment name

## Step 4: Deploy

1. Railway will automatically start the deployment when you:
   - Push code to the connected branch
   - Click **"Deploy"** in the dashboard
2. Watch the build logs in the Railway dashboard
3. Once deployed, Railway will provide a public URL

## Step 5: Verify Deployment

### Health Check
Visit: `https://your-app.railway.app/health`

Expected response:
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-01-27T...",
  "environment": "development"
}
```

### API Info
Visit: `https://your-app.railway.app/api`

Expected response:
```json
{
  "success": true,
  "message": "QueryAI API v1.0.0",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "api": "/api"
  }
}
```

## Step 6: Configure Custom Domain (Optional)

1. Go to your service → **Settings** → **Networking**
2. Click **"Generate Domain"** or **"Custom Domain"**
3. For custom domain, add a CNAME record pointing to Railway

## Monitoring & Logs

### View Logs
- **Dashboard**: Click on your service → **Logs** tab
- View real-time logs, build logs, and deployment logs

### Health Monitoring
- Railway automatically monitors the `/health` endpoint
- Service will restart if health checks fail

## Environment-Specific Configuration

### Development Environment
- Use `NODE_ENV=development`
- Enable verbose logging: `LOG_LEVEL=debug`
- Allow localhost CORS for testing

### Production Environment (Later)
- Use `NODE_ENV=production`
- Set `LOG_LEVEL=info` or `warn`
- Configure proper CORS origins
- Use strong `JWT_SECRET`

## Troubleshooting

### Build Fails
- **Check build logs**: Ensure TypeScript compiles successfully
- **Node version**: Railway uses Node.js 18+ (configure in `package.json` if needed)
- **Dependencies**: Ensure all dependencies are in `package.json`

### Server Won't Start
- **Check logs**: Look for error messages in Railway logs
- **Port binding**: Don't hardcode port, use `process.env.PORT`
- **Environment variables**: Ensure all required variables are set

### Health Check Fails
- **Endpoint**: Verify `/health` endpoint works locally
- **Timeouts**: Railway health check has 100ms timeout
- **Server response**: Ensure server responds within timeout

### CORS Errors
- **CORS_ORIGIN**: Set `CORS_ORIGIN` to your frontend domain
- **Wildcard**: For development, you can use `*` (not recommended for production)
- **Credentials**: Ensure credentials are properly configured

## Railway CLI (Optional)

Install Railway CLI for easier management:

```bash
npm i -g @railway/cli
```

### Login
```bash
railway login
```

### Link Project
```bash
railway link
```

### Set Variables
```bash
railway variables set NODE_ENV=development
railway variables set OPENAI_API_KEY=sk-...
```

### View Logs
```bash
railway logs
```

### Open Dashboard
```bash
railway open
```

## Next Steps

After successful deployment:

1. **Test API Endpoints**: Use Postman or curl to test endpoints
2. **Monitor Logs**: Watch for errors or warnings
3. **Set up CI/CD**: Railway auto-deploys on git push
4. **Add Domain**: Configure custom domain if needed
5. **Scale**: Adjust resources as needed in Railway settings

## Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway Node.js Guide](https://docs.railway.app/guides/nodejs)
- [Environment Variables](https://docs.railway.app/develop/variables)
- [Custom Domains](https://docs.railway.app/develop/custom-domains)

---

**Note**: This deployment is for **development environment**. For production, ensure:
- Strong security configurations
- Proper error handling
- Monitoring and alerting
- Backup strategies
- SSL/TLS certificates
