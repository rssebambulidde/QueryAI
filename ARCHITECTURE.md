# System Architecture

## Overview

This document describes the technical architecture, data flow, and system design for the AI Knowledge Hub platform.

---

## Architecture Principles

1. **Multi-Tenant**: Complete user data isolation
2. **Scalable**: Serverless architecture for horizontal scaling
3. **Secure**: End-to-end encryption and authentication
4. **Cost-Effective**: Optimized API usage and caching
5. **Resilient**: Error handling and fallback mechanisms

---

## System Components

### 1. Frontend Layer

#### Web Application (Next.js)
```
Components:
├── Authentication Pages
│   ├── Login
│   ├── Signup
│   ├── Password Reset
│   └── Google OAuth Callback
├── Dashboard
│   ├── Chat Interface
│   ├── Query History
│   ├── Document Manager
│   ├── Topic Configuration
│   └── Subscription Management
├── Embeddable Chatbot
│   ├── Widget Component
│   ├── Iframe Wrapper
│   └── API Integration
└── Settings
    ├── Profile
    ├── API Keys
    └── Embed Customization
```

#### Mobile Application (React Native - Optional)
- Simplified UI optimized for mobile
- Push notifications for query responses
- Offline query caching

---

### 2. Backend API Layer

#### API Structure
```
/api
├── /auth
│   ├── POST /signup
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /reset-password
│   └── GET /oauth/google
├── /queries
│   ├── POST /ask (submit question)
│   ├── GET /history
│   ├── GET /thread/:id
│   └── POST /export
├── /documents
│   ├── POST /upload
│   ├── GET /list
│   ├── GET /:id
│   ├── DELETE /:id
│   └── POST /:id/analyze
├── /topics
│   ├── POST /create
│   ├── GET /list
│   ├── PUT /:id
│   └── DELETE /:id
├── /subscriptions
│   ├── GET /status
│   ├── POST /upgrade
│   ├── POST /cancel
│   └── GET /usage
├── /embed
│   ├── POST /chat (for embeddable bot)
│   └── GET /config/:token
└── /api-access
    ├── POST /generate-key
    ├── GET /keys
    └── DELETE /keys/:id
```

---

### 3. Authentication & Authorization

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Login Request
       ▼
┌──────────────────┐
│  Supabase Auth   │
│  • Email/Pass    │
│  • Google OAuth  │
└──────┬───────────┘
       │ 2. JWT Token
       ▼
┌──────────────────┐
│   Backend API    │
│  • Validate JWT  │
│  • Extract user  │
│  • Check RLS     │
└──────────────────┘
```

**Flow:**
1. User submits credentials
2. Supabase Auth validates and issues JWT
3. Client stores JWT (secure cookie/localStorage)
4. All API requests include JWT in Authorization header
5. Backend validates JWT and enforces RLS policies

---

### 4. Question Answering Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Question Answering Pipeline               │
└─────────────────────────────────────────────────────────────┘

1. User Input
   │
   ├─► Request: { question, topic_id, conversation_id }
   │
   ├─► Authentication Check
   │   └─► Validate JWT token
   │
   ├─► Subscription Check
   │   ├─► Verify user tier
   │   ├─► Check query limits
   │   └─► Enforce rate limits
   │
   ├─► Topic Configuration
   │   ├─► Load topic scope
   │   └─► Validate user access
   │
   ├─► Parallel Data Retrieval
   │   ├─► [A] Pinecone Vector Search
   │   │   └─► Query: topic_id + user_id + question
   │   │   └─► Return: Top K relevant document chunks
   │   │
   │   └─► [B] Tavily Search API
   │       └─► Query: question (filtered by topic)
   │       └─► Return: Relevant web search results
   │
   ├─► Context Assembly
   │   ├─► Document embeddings (from Pinecone)
   │   ├─► Web search results (from Tavily)
   │   ├─► Conversation history (from database)
   │   └─► Topic context
   │
   ├─► LLM Processing
   │   ├─► Construct prompt with:
   │   │   ├─► User question
   │   │   ├─► Document context
   │   │   ├─► Web search context
   │   │   ├─► Conversation history
   │   │   └─► Topic scope instructions
   │   │
   │   ├─► Call OpenAI/Claude API
   │   └─► Stream response back to client
   │
   ├─► Response Processing
   │   ├─► Extract citations
   │   ├─► Format sources
   │   └─► Structure answer
   │
   └─► Save & Return
       ├─► Save query/answer to database
       ├─► Update conversation thread
       ├─► Increment usage counter
       └─► Return response to client
```

---

### 5. Document Upload & Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Document Upload & Embedding Pipeline            │
└─────────────────────────────────────────────────────────────┘

1. Upload Request
   │
   ├─► Client uploads file (PDF, DOCX, Image)
   │
   ├─► Backend Validation
   │   ├─► Check file type/size
   │   ├─► Verify subscription tier allows uploads
   │   └─► Check user storage limits
   │
   ├─► File Storage
   │   └─► Upload to Supabase Storage
   │       ├─► Path: /users/{user_id}/documents/{file_id}
   │       └─► Encrypted at rest
   │
   ├─► Text Extraction
   │   ├─► PDF: pdf-parse library
   │   ├─► DOCX: mammoth library
   │   └─► Images: OCR (Tesseract.js or cloud OCR)
   │
   ├─► Text Chunking
   │   ├─► Split into chunks (500-1000 tokens)
   │   ├─► Preserve context (overlap between chunks)
   │   └─► Add metadata (file_id, chunk_index, topic_id)
   │
   ├─► Embedding Generation
   │   ├─► Generate embeddings for each chunk
   │   │   └─► OpenAI text-embedding-3-small
   │   ├─► Batch processing for efficiency
   │   └─► Store embeddings metadata in database
   │
   ├─► Vector Storage
   │   └─► Store embeddings in Pinecone
   │       ├─► Index: queryai-embeddings
   │       ├─► Metadata:
   │       │   ├─► user_id
   │       │   ├─► file_id
   │       │   ├─► topic_id (if specified)
   │       │   ├─► chunk_index
   │       │   └─► source_url
   │       └─► Vector: embedding array
   │
   └─► Completion
       ├─► Update database with file metadata
       └─► Return success to client
```

---

### 6. Embeddable Chatbot Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Embeddable Bot Flow                       │
└─────────────────────────────────────────────────────────────┘

Host Website (User's Site)
│
│ <script src="https://queryai.com/embed.js?token=xyz"></script>
│
└─► Embed Script Loads
    │
    ├─► Initialize Widget
    │   ├─► Fetch config from API (using token)
    │   ├─► Load customizations (colors, avatar, etc.)
    │   └─► Render chat UI
    │
    └─► User Interaction
        │
        ├─► User types question
        │
        ├─► POST /api/embed/chat
        │   ├─► Headers:
        │   │   ├─► Authorization: Bearer {embed_token}
        │   │   └─► X-Topic-ID: {topic_id}
        │   │
        │   └─► Body:
        │       ├─► question
        │       └─► conversation_id (optional)
        │
        ├─► Backend Processing
        │   ├─► Validate embed token
        │   ├─► Extract user_id + topic_id from token
        │   ├─► Enforce rate limits
        │   └─► Process through QA pipeline
        │
        └─► Stream response back
            └─► Display in chat UI
```

**Security Considerations:**
- Embed tokens are signed JWTs containing user_id and topic_id
- Tokens expire after set duration
- CORS restrictions for API endpoints
- Rate limiting per token
- Topic isolation enforced in backend

---

### 7. Database Schema (Supabase/PostgreSQL)

```sql
-- Users (managed by Supabase Auth)
-- Extended user profile
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    scope_config JSONB, -- Additional topic configuration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_type TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'processing', -- processing, completed, failed
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Chunks (metadata for embeddings)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER,
    content TEXT,
    embedding_id TEXT, -- Reference to Pinecone ID
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL, -- free, premium, pro
    status TEXT DEFAULT 'active', -- active, cancelled, expired
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- query, api_call, document_upload
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations/Threads
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (queries and answers)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- user, assistant
    content TEXT NOT NULL,
    sources JSONB, -- Citations and source references
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Items (many-to-many)
CREATE TABLE collection_items (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection_id, conversation_id)
);

-- Embeddable Bot Configurations
CREATE TABLE embed_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL, -- Secure embed token
    customizations JSONB, -- Colors, avatar, greeting, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    provider TEXT, -- paypal, pesapal
    provider_payment_id TEXT,
    status TEXT, -- pending, completed, failed
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Row Level Security (RLS) Policies:**
- All tables have RLS enabled
- Users can only access their own data (WHERE user_id = auth.uid())
- Admin users have elevated access (separate policy)

---

### 8. Vector Database (Pinecone) Structure

**Index:** `queryai-embeddings`

**Vector Dimensions:** 1536 (OpenAI ada-002) or 3072 (OpenAI text-embedding-3-large)

**Metadata Schema:**
```json
{
  "user_id": "uuid",
  "topic_id": "uuid",
  "document_id": "uuid",
  "chunk_index": "integer",
  "file_type": "string",
  "source_url": "string",
  "created_at": "timestamp"
}
```

**Query Strategy:**
- Filter by `user_id` + `topic_id` for topic-scoped queries
- Filter by `user_id` only for general queries
- Top K retrieval (K = 5-10 chunks)
- Similarity threshold: 0.7+

---

### 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
└─────────────────────────────────────────────────────────────┘

                          Internet
                             │
                             ▼
                    ┌────────────────┐
                    │   Cloudflare   │
                    │      CDN       │
                    └────────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │     Vercel     │
                    │  (Next.js App) │
                    └────────┬───────┘
                             │
                             ▼
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
┌───────────────┐                       ┌───────────────┐
│  Render API   │                       │  Supabase     │
│  (Backend)    │                       │  • PostgreSQL │
│               │                       │  • Storage    │
│  • Express    │                       │  • Auth       │
│  • API Routes │                       └───────────────┘
└───────┬───────┘
        │
        ├───────────────────────┬───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   OpenAI     │      │   Pinecone   │      │   Tavily     │
│   API        │      │   Vector DB  │      │   Search API │
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## Security Architecture

### 1. Data Encryption
- **At Rest**: Supabase Storage encryption
- **In Transit**: TLS/SSL for all communications
- **Secrets**: Environment variables, never in code

### 2. Authentication Flow
- JWT tokens with expiration
- Refresh token rotation
- Secure cookie storage

### 3. Authorization
- Row Level Security (RLS) in Supabase
- Backend middleware for API authorization
- Topic-level access control

### 4. API Security
- Rate limiting per user/tier
- Input validation and sanitization
- CORS configuration
- API key authentication for embeds

---

## Scalability Considerations

### Horizontal Scaling
- Stateless backend API (can scale horizontally)
- Serverless functions (auto-scaling)
- CDN for static assets

### Database Scaling
- Connection pooling
- Read replicas for heavy queries
- Indexing strategy

### Vector Database
- Pinecone auto-scaling
- Separate indexes per major topic (if needed)

### Cost Optimization
- Caching frequently accessed data
- Batch API calls where possible
- Topic filtering to reduce search scope
- Lifecycle policies for old data

---

**Last Updated:** 2025-01-27
