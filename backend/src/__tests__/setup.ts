// Test setup file
// This runs before all tests

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
