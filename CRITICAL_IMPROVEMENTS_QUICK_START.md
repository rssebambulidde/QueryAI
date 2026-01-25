# Critical Improvements - Quick Start Guide

**Priority:** 🔴 Implement within 1-2 weeks

This guide provides step-by-step instructions for implementing the most critical improvements identified in the deployment gaps assessment.

---

## 1. Error Tracking with Sentry (Day 1-2)

### Backend Setup

1. **Install Sentry:**
```bash
cd backend
npm install @sentry/node @sentry/profiling-node
```

2. **Initialize in `backend/src/server.ts` (at the top, before other imports):**
```typescript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  integrations: [
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 1.0, // Adjust based on traffic
  profilesSampleRate: 1.0,
});
```

3. **Add to Railway environment variables:**
```
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

4. **Wrap error handler:**
```typescript
// In errorHandler.ts
import * as Sentry from "@sentry/node";

export const errorHandler = (err, req, res, next) => {
  Sentry.captureException(err);
  // ... existing error handling
};
```

### Frontend Setup

1. **Install Sentry:**
```bash
cd frontend
npm install @sentry/nextjs
```

2. **Initialize Sentry:**
```bash
npx @sentry/wizard@latest -i nextjs
```

3. **Add to Cloudflare Pages environment variables:**
```
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
```

4. **Update `sentry.client.config.ts` and `sentry.server.config.ts`** (auto-generated)

---

## 2. Uptime Monitoring (Day 2-3)

### Option A: UptimeRobot (Free)

1. **Sign up:** https://uptimerobot.com
2. **Add Monitor:**
   - Type: HTTP(s)
   - URL: `https://your-backend.railway.app/health`
   - Interval: 5 minutes
   - Alert Contacts: Your email
3. **Add Second Monitor:**
   - URL: `https://queryai-frontend.pages.dev`
   - Same settings

### Option B: Cloudflare Monitoring (If on paid plan)

1. **Enable in Cloudflare Dashboard:**
   - Workers & Pages → Your Project → Analytics
   - Enable uptime monitoring
   - Set alert thresholds

### Option C: Pingdom (Alternative)

1. **Sign up:** https://www.pingdom.com
2. **Add HTTP Check:**
   - URL: Backend health endpoint
   - Expected status: 200
   - Alert on: Downtime or slow response

---

## 3. Backup Strategy Documentation (Day 3-4)

### Create `BACKUP_STRATEGY.md`:

```markdown
# Backup Strategy

## Database Backups
- **Provider:** Supabase (managed)
- **Frequency:** Daily (verify in Supabase dashboard)
- **Retention:** 7 days (verify)
- **Location:** Supabase managed storage
- **Restore Process:** [Document steps from Supabase dashboard]

## Configuration Backups
- **Frequency:** Weekly
- **Method:** Export Railway environment variables
- **Storage:** Secure, encrypted location (1Password, etc.)
- **Backup Command:**
  ```bash
  # Export from Railway CLI or dashboard
  railway variables --json > backup/env-vars-$(date +%Y%m%d).json
  ```

## Recovery Procedures
1. Database restore: [Steps]
2. Configuration restore: [Steps]
3. Service restart: [Steps]

## Testing
- Test restore quarterly
- Last tested: [Date]
```

### Verify Supabase Backups:

1. Go to Supabase Dashboard
2. Project Settings → Database → Backups
3. Document backup schedule and retention
4. Test restore process in staging

---

## 4. Security Audit (Day 4-5)

### Dependency Scanning

1. **Run audit:**
```bash
cd backend
npm audit
npm audit fix

cd ../frontend
npm audit
npm audit fix
```

2. **Set up Dependabot (GitHub):**
   - Create `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/backend"
       schedule:
         interval: "weekly"
     - package-ecosystem: "npm"
       directory: "/frontend"
       schedule:
         interval: "weekly"
   ```

3. **Fix critical vulnerabilities immediately**
4. **Document medium/low vulnerabilities and plan fixes**

### Environment Variable Audit

1. **Verify no secrets in code:**
```bash
# Search for potential secrets
grep -r "password\|secret\|key\|token" --include="*.ts" --include="*.js" | grep -v "node_modules" | grep -v ".env"
```

2. **Verify .gitignore:**
```bash
# Check .gitignore includes:
.env
.env.local
.env.*.local
*.log
```

---

## 5. Performance Monitoring (Day 5-7)

### Railway Built-in Monitoring

1. **Enable in Railway Dashboard:**
   - Your Service → Metrics
   - Enable CPU, Memory, Network monitoring
   - Set up alerts for:
     - CPU > 80%
     - Memory > 80%
     - Response time > 2s

### Add Response Time Logging

1. **Update `backend/src/middleware/requestLogger.ts`:**
```typescript
// Add response time tracking
const startTime = Date.now();
res.on('finish', () => {
  const duration = Date.now() - startTime;
  logger.info('Request completed', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: `${duration}ms`,
    // Alert if slow
    ...(duration > 2000 && { slow: true }),
  });
});
```

---

## 6. Log Aggregation (Day 7-10)

### Option A: Railway Log Streaming

1. **Use Railway CLI:**
```bash
railway logs --follow
```

2. **Or use Railway Dashboard:**
   - View logs in real-time
   - Search and filter

### Option B: External Service (Logtail/Axiom)

1. **Sign up for Logtail:**
   - https://logtail.com

2. **Install:**
```bash
cd backend
npm install @logtail/node
```

3. **Add to logger:**
```typescript
import { Logtail } from "@logtail/node";

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

// Add to Winston transports
logger.add(new winston.transports.Http({
  host: 'in.logtail.com',
  path: '/',
  ssl: true,
}));
```

---

## 7. Health Check Enhancement (Day 10-14)

### Enhanced Health Check

1. **Update `backend/src/server.ts` health endpoint:**
```typescript
app.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    database: await checkDatabaseHealth(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
    },
    uptime: process.uptime(),
  };

  const isHealthy = checks.database.connected && checks.memory.percentage < 90;
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

### Frontend Health Check

1. **Create `frontend/lib/health-check.ts`:**
```typescript
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

2. **Use in app:**
```typescript
// In app layout or dashboard
useEffect(() => {
  const interval = setInterval(async () => {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      // Show warning to user
      console.warn('Backend health check failed');
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, []);
```

---

## 📋 Implementation Checklist

### Week 1
- [ ] Day 1-2: Set up Sentry (backend + frontend)
- [ ] Day 2-3: Configure uptime monitoring
- [ ] Day 3-4: Document backup strategy
- [ ] Day 4-5: Run security audit and fix critical issues
- [ ] Day 5-7: Set up performance monitoring

### Week 2
- [ ] Day 7-10: Set up log aggregation
- [ ] Day 10-14: Enhance health checks
- [ ] Day 14: Review and document improvements

---

## 🎯 Success Metrics

After implementation, you should have:

1. ✅ **Error Tracking:** All errors automatically reported to Sentry
2. ✅ **Uptime Monitoring:** Alerts within 5 minutes of downtime
3. ✅ **Backup Documentation:** Clear backup and restore procedures
4. ✅ **Security:** No critical vulnerabilities, automated scanning
5. ✅ **Performance Monitoring:** Visibility into system performance
6. ✅ **Log Aggregation:** Centralized, searchable logs

---

## 📚 Resources

- **Sentry Docs:** https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **UptimeRobot:** https://uptimerobot.com
- **Railway Metrics:** https://docs.railway.app/develop/metrics
- **npm audit:** https://docs.npmjs.com/cli/v8/commands/npm-audit

---

**Estimated Time:** 10-14 days  
**Priority:** 🔴 CRITICAL  
**Impact:** High - Significantly improves production readiness
