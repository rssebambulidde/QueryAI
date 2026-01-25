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

Railway supports native cron jobs using a crontab expression in the service settings.

1. Go to Railway Dashboard → Your Project → Your Backend Service
2. Navigate to **Settings** tab
3. Scroll to **"Cron Schedule"** field
4. Enter crontab expression: `0 0 * * *` (daily at midnight UTC)
5. **Important:** Your service must exit after completing the task

**Crontab Format:** `minute hour day-of-month month day-of-week`

**Examples:**
- Daily at midnight UTC: `0 0 * * *`
- Every hour at 30 minutes: `30 * * * *`
- Every Monday at 8 AM: `0 8 * * 1`
- Every 15 minutes: `*/15 * * * *`

**Note:** Railway cron jobs require your service to:
- Exit completely after finishing the task
- Close all connections (database, etc.)
- If a previous execution is still running, Railway will skip the next execution

**Implementation:** Modify your `server.ts` to check for cron execution:
```typescript
// At the end of server.ts
if (process.env.RAILWAY_CRON === 'true') {
  // Run renewal job and exit
  import('./jobs/renewal-job').then(({ runRenewalJob }) => {
    runRenewalJob()
      .then(() => {
        logger.info('Renewal job completed, exiting...');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Renewal job failed:', error);
        process.exit(1);
      });
  });
} else {
  // Normal server startup
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}
```

Then set environment variable `RAILWAY_CRON=true` in Railway settings.

### Option 2: Separate Railway Service (Alternative)

Create a separate Railway service specifically for the renewal job:

1. Create a new service in your Railway project
2. Use the same codebase but with a different start command
3. Set **Start Command** to: `node -e "require('./dist/jobs/renewal-job').runRenewalJob().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })"`
4. Set **Cron Schedule** to: `0 0 * * *`
5. This service will run the job and exit

### Option 3: GitHub Actions Scheduled Workflow

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

### Option 4: External Cron Service

Use services like:
- **cron-job.org** (free tier available)
- **EasyCron**
- **Cronitor**

Configure:
- **URL:** `https://your-backend-url/api/jobs/renewals`
- **Method:** POST
- **Schedule:** Daily at midnight UTC
- **Headers:** Optional authentication header if you add it

### Option 5: Node-cron (Single Instance)

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
