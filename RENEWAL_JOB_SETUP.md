# Renewal Job Setup Guide

## Overview

The renewal job processes subscription renewals and payment retries automatically. It should be run daily (preferably at midnight UTC).

## Endpoint

**POST** `/api/jobs/renewals`

This endpoint:
- Processes subscription renewals (auto-extends periods for paid subscriptions)
- Processes failed payment retries
- Handles grace periods
- Downgrades cancelled subscriptions

## Setup Options

### Option 1: Railway Cron Jobs (Recommended)

1. Go to Railway Dashboard → Your Project
2. Navigate to **Settings** → **Cron Jobs**
3. Add new cron job:
   - **Schedule:** `0 0 * * *` (daily at midnight UTC)
   - **Command:** `curl -X POST https://your-backend-url.railway.app/api/jobs/renewals`
   - **Method:** POST

### Option 2: GitHub Actions Scheduled Workflow

Create `.github/workflows/renewal-job.yml`:

```yaml
name: Renewal Job

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  renewal:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Renewal Job
        run: |
          curl -X POST ${{ secrets.BACKEND_URL }}/api/jobs/renewals
        env:
          BACKEND_URL: ${{ secrets.BACKEND_URL }}
```

### Option 3: External Cron Service

Use services like:
- **cron-job.org** (free tier available)
- **EasyCron**
- **Cronitor**

Configure:
- **URL:** `https://your-backend-url/api/jobs/renewals`
- **Method:** POST
- **Schedule:** Daily at midnight UTC
- **Headers:** Optional authentication header if you add it

### Option 4: Node-cron (Single Instance)

If running a single instance, you can use node-cron:

```typescript
import cron from 'node-cron';
import { runRenewalJob } from './jobs/renewal-job';

// Run daily at midnight UTC
cron.schedule('0 0 * * *', async () => {
  await runRenewalJob();
});
```

**Note:** This only works for single-instance deployments. For Railway with multiple replicas, use Option 1.

## Security

**Current Implementation:** No authentication (for simplicity)

**Recommended:** Add authentication for production:
- API key in header
- Secret token
- IP whitelist

Example:
```typescript
app.post('/api/jobs/renewals', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.RENEWAL_JOB_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  // ... rest of the code
});
```

## Monitoring

Check logs after job runs to verify:
- Subscriptions renewed successfully
- Payment retries processed
- Grace periods handled correctly

## Testing

Manually trigger the job:
```bash
curl -X POST https://your-backend-url/api/jobs/renewals
```

Check response and logs to verify it's working.
