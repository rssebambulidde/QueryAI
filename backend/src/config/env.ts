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
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value && key !== 'ANTHROPIC_API_KEY' && key !== 'TAVILY_API_KEY' && 
      key !== 'PINECONE_API_KEY' && key !== 'PINECONE_ENVIRONMENT' && 
      key !== 'PINECONE_INDEX_NAME' && key !== 'OPENAI_API_KEY') {
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

  // Payment Processing (Pesapal)
  PESAPAL_CONSUMER_KEY: getEnvVar('PESAPAL_CONSUMER_KEY'),
  PESAPAL_CONSUMER_SECRET: getEnvVar('PESAPAL_CONSUMER_SECRET'),
  PESAPAL_ENVIRONMENT: (getEnvVar('PESAPAL_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production') || 'sandbox',
  PESAPAL_WEBHOOK_URL: getEnvVar('PESAPAL_WEBHOOK_URL'),
};

export default config;
