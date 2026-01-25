# Tech Stack Documentation

## Overview

This document details the complete technology stack for the AI Knowledge Hub project, including specific libraries, frameworks, and services.

---

## Backend

### Runtime & Framework
- **Node.js** (v18+ LTS) or **Python 3.11+**
- **Express.js** (Node.js) or **FastAPI** (Python)
  - Express: Lightweight, flexible, mature ecosystem
  - FastAPI: Modern, async-first, excellent for AI/ML workloads

### API & Server
- **REST API** architecture
- **GraphQL** (optional, for complex queries)
- **WebSocket** support (for real-time chat streaming)

### Authentication & Security
- **Supabase Auth**: User management, JWT tokens
- **Google OAuth 2.0**: Social login
- **JWT**: Token-based authentication
- **bcrypt**: Password hashing
- **CORS**: Cross-origin resource sharing
- **Helmet.js**: Security headers

---

## Database & Storage

### Primary Database
- **Supabase (PostgreSQL 15+)**
  - User data
  - Topics and configurations
  - Subscriptions and billing
  - Query history and threads
  - Collections and metadata

### Vector Database
- **Pinecone**
  - Document embeddings storage
  - Semantic search
  - Topic-filtered retrieval
  - Index management

### File Storage
- **Supabase Storage** (S3-compatible)
  - PDF, DOCX, image storage
  - User file isolation
  - Encryption at rest
  - CDN delivery

### Caching
- **Redis** (optional, for session management and caching)
- **Upstash Redis** (serverless Redis alternative)

---

## AI & Search Services

### Large Language Models
- **OpenAI GPT-4 / GPT-3.5 Turbo**
  - Primary LLM provider
  - Text generation
  - Embedding generation (text-embedding-ada-002)
  
- **Anthropic Claude** (Alternative/Backup)
  - Claude 3 Sonnet or Opus
  - Alternative for reliability

### Search API
- **Tavily Search API**
  - Real-time web search
  - Topic filtering
  - Result ranking
  - News and recent information

### Embedding Models
- **OpenAI text-embedding-ada-002** (recommended)
- **OpenAI text-embedding-3-small/large** (newer, higher quality)
- **Alternative**: Sentence Transformers for local embeddings

---

## Frontend

### Framework
- **Next.js 14+** (React framework)
  - App Router
  - Server-side rendering (SSR)
  - API routes
  - Optimized performance

### UI Library & Styling
- **React 18+**
- **Tailwind CSS 3+**: Utility-first CSS framework
- **Shadcn/ui** or **Radix UI**: Component library
- **Framer Motion**: Animations
- **React Hook Form**: Form management
- **Zod**: Schema validation

### State Management
- **Zustand** or **Redux Toolkit**: Global state
- **React Query / TanStack Query**: Server state management
- **SWR**: Data fetching and caching

### Chat Interface
- **React Chat UI Components**
  - Custom chat components
  - Message streaming
  - Typing indicators
  - File upload UI

---

## Mobile (Optional)

### Framework
- **React Native** (recommended)
  - Code sharing with web
  - Native performance
  - Expo for easier development

### Alternative
- **Flutter** (Dart)
  - Excellent UI performance
  - Single codebase for iOS/Android

---

## Payment Processing

### Payment Providers
- **PayPal SDK**
  - International payments
  - Recurring subscriptions
  - Webhook handling

- **Pesapal SDK**
  - African market payments
  - Mobile money integration
  - M-Pesa, Airtel Money support

### Payment Libraries
- **Stripe** (optional, additional option)
- **Paddle** (alternative subscription management)

---

## Development Tools

### Package Management
- **npm** or **yarn** (Node.js)
- **pip** or **poetry** (Python)
- **pnpm** (faster alternative for Node.js)

### Build Tools
- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

### Testing
- **Jest**: Unit testing
- **Vitest**: Fast unit testing (alternative)
- **React Testing Library**: Component testing
- **Playwright** or **Cypress**: E2E testing
- **Supertest**: API testing

### Documentation
- **Swagger/OpenAPI**: API documentation
- **TypeDoc** (TypeScript) or **Sphinx** (Python): Code documentation

---

## Deployment & Infrastructure

### Hosting Platforms
- **Vercel** (recommended for Next.js)
  - Zero-config deployment
  - Serverless functions
  - Edge network

- **Render**
  - Full-stack hosting
  - PostgreSQL databases
  - Background workers

- **AWS**
  - EC2 or Lambda
  - RDS for PostgreSQL
  - S3 for storage
  - CloudFront CDN

### CI/CD
- **GitHub Actions**: Automated testing and deployment
- **Vercel**: Automatic deployments from Git

### Monitoring & Logging
- **Sentry**: Error tracking
- **LogRocket** or **Datadog**: Application monitoring
- **SupaBase Logs**: Database monitoring
- **Vercel Analytics**: Web analytics

---

## Environment Variables Template

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...

# Vector Database
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=queryai-embeddings

# Payments
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox|live
PESAPAL_CONSUMER_KEY=...
PESAPAL_CONSUMER_SECRET=...
PESAPAL_ENVIRONMENT=sandbox|production

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production|development
PORT=3000

# Storage
SUPABASE_STORAGE_BUCKET=documents

# Redis (optional)
REDIS_URL=redis://...
```

---

## Recommended Package List (Node.js/Express)

### Core Dependencies
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "dotenv": "^16.3.1",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "express-rate-limit": "^7.1.5"
}
```

### Supabase
```json
{
  "@supabase/supabase-js": "^2.38.4",
  "@supabase/storage-js": "^2.4.0"
}
```

### AI & Search
```json
{
  "openai": "^4.20.1",
  "@anthropic-ai/sdk": "^0.9.1",
  "tavily": "^1.0.0"
}
```

### Vector DB
```json
{
  "@pinecone-database/pinecone": "^1.1.2"
}
```

### Payments
```json
{
  "paypal-rest-sdk": "^1.8.1",
  "pesapal-sdk": "^1.0.0"
}
```

### Utilities
```json
{
  "zod": "^3.22.4",
  "axios": "^1.6.2",
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",
  "sharp": "^0.32.6"
}
```

---

## Recommended Package List (Next.js Frontend)

### Core
```json
{
  "next": "^14.0.4",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.3"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.32",
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-dropdown-menu": "^2.0.6"
}
```

### State & Data
```json
{
  "zustand": "^4.4.7",
  "@tanstack/react-query": "^5.14.2",
  "axios": "^1.6.2",
  "zod": "^3.22.4",
  "react-hook-form": "^7.49.3",
  "@hookform/resolvers": "^3.3.2"
}
```

### UI Components
```json
{
  "framer-motion": "^10.16.16",
  "lucide-react": "^0.294.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.2.0"
}
```

---

## Version Control & Collaboration

### Git
- **GitHub**: Repository hosting
- **Git Flow**: Branching strategy (main, development, feature branches)

### Documentation
- **Markdown**: Documentation format
- **README.md**: Project overview
- **API Documentation**: OpenAPI/Swagger

---

**Last Updated:** 2025-01-27
