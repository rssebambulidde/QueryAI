import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import config from './config/env';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { checkDatabaseHealth } from './config/database';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import searchRoutes from './routes/search.routes';
import documentsRoutes from './routes/documents.routes';
import conversationsRoutes from './routes/conversations.routes';
import topicsRoutes from './routes/topics.routes';
import collectionsRoutes from './routes/collections.routes';
import analyticsRoutes from './routes/analytics.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import usageRoutes from './routes/usage.routes';
import billingRoutes from './routes/billing.routes';
import enterpriseRoutes from './routes/enterprise.routes';
import testRoutes from './routes/test.routes';
import debugRoutes from './routes/debug.routes';
import cacheRoutes from './routes/cache.routes';
import connectionsRoutes from './routes/connections.routes';
import metricsRoutes from './routes/metrics.routes';
import adminRoutes from './routes/admin.routes';

const app: Express = express();

// Trust proxy - Required for reverse proxy environments (Railway, Cloudflare, etc.)
// Trust only first proxy (more secure than 'true')
app.set('trust proxy', 1);

// Security middleware
// Configure Helmet to allow streaming endpoints
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
    },
  },
  // Disable contentSecurityPolicy for streaming endpoints (handled in route)
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Parse CORS_ORIGIN - support comma-separated origins; strip quotes (Railway/env sometimes add them)
    const corsOrigins = config.CORS_ORIGIN
      .split(',')
      .map(o => o.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);

    // Helper to normalize URL: add https if needed, strip trailing slash (browser sends origin without slash)
    const normalizeUrl = (url: string): string => {
      const trimmed = url.trim().replace(/\/+$/, '');
      if (!trimmed) return '';
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      return `https://${trimmed}`;
    };

    const allowedOrigins = [
      ...corsOrigins.map(normalizeUrl),
      // Cloudflare Pages frontend (if set)
      ...(process.env.CLOUDFLARE_PAGES_URL
        ? [normalizeUrl(process.env.CLOUDFLARE_PAGES_URL)]
        : []),
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    const normalizedOrigin = origin.replace(/\/+$/, '');
    const exactMatch = allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes(origin);
    // Allow Cloudflare Pages preview URLs: https://<deployment-id>.queryai-frontend.pages.dev
    const isCloudflarePreview = /^https:\/\/[a-z0-9-]+\.queryai-frontend\.pages\.dev$/i.test(normalizedOrigin);
    if (exactMatch || isCloudflarePreview || config.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for API tester)
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/test', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
}

// Renewal job endpoint (can be called by cron)
app.post('/api/jobs/renewals', async (_req: Request, res: Response) => {
  try {
    const { runRenewalJob } = await import('./jobs/renewal-job');
    await runRenewalJob();
    res.status(200).json({
      success: true,
      message: 'Renewal job completed successfully',
    });
  } catch (error: any) {
    logger.error('Renewal job endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Renewal job failed',
      error: error.message,
    });
  }
});

// Email scheduler endpoint (payment/renewal/expiration reminders + queue). Call daily via cron.
app.post('/api/jobs/email-scheduler', async (_req: Request, res: Response) => {
  try {
    const { runEmailScheduler } = await import('./cron/email-scheduler');
    await runEmailScheduler();
    res.status(200).json({
      success: true,
      message: 'Email scheduler completed successfully',
    });
  } catch (error: any) {
    logger.error('Email scheduler endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Email scheduler failed',
      error: error.message,
    });
  }
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'QueryAI API - AI Knowledge Hub',
    version: '1.0.0',
    status: 'operational',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      root: '/',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        forgotPassword: 'POST /api/auth/forgot-password',
        magicLink: 'POST /api/auth/magic-link',
        invite: 'POST /api/auth/invite',
        inviteGuest: 'POST /api/auth/invite-guest',
        resetPassword: 'POST /api/auth/reset-password',
        me: 'GET /api/auth/me',
      },
    },
    documentation: {
      github: 'https://github.com/rssebambulidde/QueryAI',
    },
  });
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  
  res.status(dbHealth.connected ? 200 : 503).json({
    success: dbHealth.connected,
    message: 'Server health check',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    database: {
      connected: dbHealth.connected,
      message: dbHealth.message,
    },
  });
});

// CORS check - call from frontend origin to verify CORS allows your site
app.get('/cors-check', (req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: 'CORS allows this origin',
    origin: req.headers.origin || '(none)',
  });
});

// API info endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'QueryAI API v1.0.0',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      root: '/',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        forgotPassword: 'POST /api/auth/forgot-password',
        magicLink: 'POST /api/auth/magic-link',
        invite: 'POST /api/auth/invite',
        inviteGuest: 'POST /api/auth/invite-guest',
        resetPassword: 'POST /api/auth/reset-password',
        me: 'GET /api/auth/me',
      },
      ai: {
        ask: 'POST /api/ai/ask',
        askStream: 'POST /api/ai/ask/stream',
      },
      search: {
        search: 'POST /api/search',
        cacheStats: 'GET /api/search/cache/stats',
        clearCache: 'DELETE /api/search/cache',
      },
      documents: {
        upload: 'POST /api/documents/upload',
        list: 'GET /api/documents',
        delete: 'DELETE /api/documents',
      },
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize request queue and worker
async function initializeQueue() {
  try {
    const { RequestQueueService } = await import('./services/request-queue.service');
    const { RAGWorker } = await import('./workers/rag-worker');
    
    await RequestQueueService.initialize();
    await RAGWorker.initialize();
    
    logger.info('Request queue and worker initialized');
  } catch (error: any) {
    logger.warn('Failed to initialize request queue (continuing without queue)', {
      error: error.message,
    });
  }
}

// Start server
const PORT = config.PORT;

// Initialize queue on startup
initializeQueue().catch((error) => {
  logger.error('Queue initialization error:', error);
});

// Check if running as Railway cron job
if (process.env.RAILWAY_CRON === 'true') {
  logger.info('Running as Railway cron job...');
  import('./jobs/renewal-job').then(({ runRenewalJobAndExit }) => {
    runRenewalJobAndExit();
  }).catch((error) => {
    logger.error('Failed to run renewal job:', error);
    process.exit(1);
  });
} else {
  // Normal server startup
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      environment: config.NODE_ENV,
      port: PORT,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
      // Close queue and worker
      try {
        const { RequestQueueService } = await import('./services/request-queue.service');
        const { RAGWorker } = await import('./workers/rag-worker');
        await RequestQueueService.close();
        await RAGWorker.close();
      } catch (error) {
        logger.warn('Error closing queue/worker:', error);
      }
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(async () => {
      // Close queue and worker
      try {
        const { RequestQueueService } = await import('./services/request-queue.service');
        const { RAGWorker } = await import('./workers/rag-worker');
        await RequestQueueService.close();
        await RAGWorker.close();
      } catch (error) {
        logger.warn('Error closing queue/worker:', error);
      }
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  process.exit(1);
});

export default app;
