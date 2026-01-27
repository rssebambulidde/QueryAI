import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  // Server
  NODE_ENV: string;
  PORT: number;
  API_BASE_URL: string;

  // Database (Supabase)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;

  // AI Services
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  EMBEDDING_MODEL?: string; // Embedding model: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
  EMBEDDING_BATCH_SIZE?: string; // Batch size for embedding generation (default: 100, max: 2048)

  // Search API
  TAVILY_API_KEY?: string;

  // Vector Database
  PINECONE_API_KEY?: string;
  PINECONE_ENVIRONMENT?: string;
  PINECONE_INDEX_NAME?: string;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // CORS
  CORS_ORIGIN: string;

  // Logging
  LOG_LEVEL: string;

  // Payment Processing (Pesapal)
  PESAPAL_CONSUMER_KEY?: string;
  PESAPAL_CONSUMER_SECRET?: string;
  PESAPAL_ENVIRONMENT?: 'sandbox' | 'production';
  PESAPAL_WEBHOOK_URL?: string;

  // Frontend URL (for payment redirects)
  FRONTEND_URL?: string;

  // Email Service (Brevo)
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;

  // Redis Cache
  REDIS_URL?: string; // Redis connection URL (redis://[username]:[password]@[host]:[port]/[database])
  REDIS_HOST?: string; // Redis host (if not using REDIS_URL)
  REDIS_PORT?: number; // Redis port (if not using REDIS_URL)
  REDIS_PASSWORD?: string; // Redis password (if not using REDIS_URL)
  REDIS_USERNAME?: string; // Redis username (if not using REDIS_URL)
  REDIS_DATABASE?: number; // Redis database number (if not using REDIS_URL)
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  const optionalKeys = [
    'ANTHROPIC_API_KEY',
    'TAVILY_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT',
    'PINECONE_INDEX_NAME',
    'OPENAI_API_KEY',
    'PESAPAL_CONSUMER_KEY',
    'PESAPAL_CONSUMER_SECRET',
    'PESAPAL_ENVIRONMENT',
    'PESAPAL_WEBHOOK_URL',
    'FRONTEND_URL',
    'BREVO_API_KEY',
    'BREVO_SENDER_EMAIL',
    'BREVO_SENDER_NAME',
    'EMBEDDING_MODEL',
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'REDIS_USERNAME',
    'REDIS_DATABASE',
  ];
  if (!value && !optionalKeys.includes(key)) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
};

const config: EnvConfig = {
  // Server
  NODE_ENV: getEnvVar('NODE_ENV', process.env.NODE_ENV || 'development'),
  // PORT is provided by the hosting platform (Railway, Cloudflare Workers, etc.)
  PORT: parseInt(process.env.PORT || getEnvVar('PORT', '3001'), 10),
  API_BASE_URL: getEnvVar('API_BASE_URL', 'http://localhost:3001'),

  // Database (Supabase)
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_STORAGE_BUCKET: getEnvVar('SUPABASE_STORAGE_BUCKET', 'documents'),

  // AI Services (OpenAI is optional but recommended for AI features)
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),
  ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY'),
  EMBEDDING_MODEL: getEnvVar('EMBEDDING_MODEL', 'text-embedding-3-small'),

  // Search API
  TAVILY_API_KEY: getEnvVar('TAVILY_API_KEY'),

  // Vector Database
  PINECONE_API_KEY: getEnvVar('PINECONE_API_KEY'),
  PINECONE_ENVIRONMENT: getEnvVar('PINECONE_ENVIRONMENT'),
  PINECONE_INDEX_NAME: getEnvVar('PINECONE_INDEX_NAME', 'queryai-embeddings'),

  // Authentication
  JWT_SECRET: getEnvVar('JWT_SECRET', 'your-secret-key-change-in-production'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '7d'),

  // CORS - Support comma-separated origins for multiple frontends (Cloudflare Pages, etc.)
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 
    process.env.CLOUDFLARE_PAGES_URL
      ? `https://${process.env.CLOUDFLARE_PAGES_URL}`
      : 'http://localhost:3000'),

  // Logging
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),

  // Payment Processing (Pesapal) - Optional
  PESAPAL_CONSUMER_KEY: getEnvVar('PESAPAL_CONSUMER_KEY') || undefined,
  PESAPAL_CONSUMER_SECRET: getEnvVar('PESAPAL_CONSUMER_SECRET') || undefined,
  PESAPAL_ENVIRONMENT: (getEnvVar('PESAPAL_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production') || 'sandbox',
  PESAPAL_WEBHOOK_URL: getEnvVar('PESAPAL_WEBHOOK_URL') || undefined,

  // Frontend URL (for payment redirects) - Optional
  FRONTEND_URL: getEnvVar('FRONTEND_URL') || undefined,

  // Email Service (Brevo) - Optional
  BREVO_API_KEY: getEnvVar('BREVO_API_KEY') || undefined,
  BREVO_SENDER_EMAIL: getEnvVar('BREVO_SENDER_EMAIL', 'noreply@queryai.com'),
  BREVO_SENDER_NAME: getEnvVar('BREVO_SENDER_NAME', 'QueryAI'),

  // Redis Cache - Optional (for distributed caching)
  REDIS_URL: getEnvVar('REDIS_URL') || undefined,
  REDIS_HOST: getEnvVar('REDIS_HOST') || undefined,
  REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
  REDIS_PASSWORD: getEnvVar('REDIS_PASSWORD') || undefined,
  REDIS_USERNAME: getEnvVar('REDIS_USERNAME') || undefined,
  REDIS_DATABASE: process.env.REDIS_DATABASE ? parseInt(process.env.REDIS_DATABASE, 10) : undefined,
};

export default config;
