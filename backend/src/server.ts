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
import embeddingsRoutes from './routes/embeddings.routes';
import conversationsRoutes from './routes/conversations.routes';
import topicsRoutes from './routes/topics.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import customApiRoutes from './routes/custom-api.routes';
import embeddingsRoutes from './routes/embeddings.routes';
import testRoutes from './routes/test.routes';
import debugRoutes from './routes/debug.routes';

const app: Express = express();

// Trust proxy - Required for Railway's reverse proxy
// Trust only Railway's proxy (more secure than 'true')
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

    const allowedOrigins = [
      config.CORS_ORIGIN,
      // Railway development environment (backend)
      ...(process.env.RAILWAY_PUBLIC_DOMAIN 
        ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`] 
        : []),
      // Railway frontend service (if set)
      ...(process.env.RAILWAY_FRONTEND_DOMAIN
        ? [`https://${process.env.RAILWAY_FRONTEND_DOMAIN}`]
        : []),
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    if (allowedOrigins.includes(origin) || config.NODE_ENV === 'development') {
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
app.use('/api/documents', embeddingsRoutes); // Embedding endpoints use same base path
app.use('/api/conversations', conversationsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/embeddings', embeddingsRoutes);
app.use('/api/v1', customApiRoutes); // Custom API with API key auth
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
}

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

// Start server
const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: config.NODE_ENV,
    port: PORT,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

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
