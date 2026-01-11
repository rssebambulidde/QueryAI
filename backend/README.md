# QueryAI Backend API

Backend API server for QueryAI - AI Knowledge Hub platform.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting
- **Environment**: dotenv

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── env.ts       # Environment variables
│   │   └── logger.ts    # Winston logger setup
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.ts    # Error handling
│   │   ├── requestLogger.ts   # Request logging
│   │   └── rateLimiter.ts     # Rate limiting
│   ├── routes/          # API routes (to be added)
│   ├── services/        # Business logic services (to be added)
│   ├── types/           # TypeScript type definitions
│   │   ├── error.ts     # Error types
│   │   ├── user.ts      # User types
│   │   └── express.d.ts # Express type extensions
│   ├── utils/           # Utility functions (to be added)
│   └── server.ts        # Main server file
├── dist/                # Compiled JavaScript (generated)
├── logs/                # Log files (generated)
├── .env                 # Environment variables (create from .env.example)
├── .env.example         # Example environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Update the `.env` file with your actual API keys and configuration.

### 3. Build TypeScript

```bash
npm run build
```

### 4. Run Development Server

```bash
npm run dev
```

This will start the server with hot-reload using `tsx watch`.

### 5. Run Production Server

```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server (requires build first)
- `npm run lint` - Run ESLint
- `npm run type-check` - Check TypeScript types without emitting

## API Endpoints

### Health Check
- `GET /health` - Server health status

### API Info
- `GET /api` - API information and version

## Environment Variables

See `.env.example` for all required environment variables.

### Required
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3001)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `JWT_SECRET` - JWT secret for token signing
- `CORS_ORIGIN` - Allowed CORS origin

### Optional
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `TAVILY_API_KEY` - Tavily Search API key
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_ENVIRONMENT` - Pinecone environment
- `PINECONE_INDEX_NAME` - Pinecone index name
- `LOG_LEVEL` - Logging level (default: info)

## Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

In development, logs are also output to the console.

## Error Handling

The backend uses a centralized error handling system:
- Custom error classes in `src/types/error.ts`
- Error handler middleware in `src/middleware/errorHandler.ts`
- Consistent error response format

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP

## Security

- Helmet.js for security headers
- CORS configured
- Rate limiting enabled
- Input validation (to be added)
- JWT authentication (to be added)

## Development Status

**Phase 1.1 - Backend Foundation** ✅
- [x] Node.js/Express project setup
- [x] TypeScript configuration
- [x] Environment variables management
- [x] Error handling middleware
- [x] Logging system

**Next Steps:**
- Phase 1.2: Database Setup
- Phase 1.3: Authentication
- Phase 1.4: Basic AI Integration
