# AI Knowledge Hub - Project Specification

## Overview

**AI Knowledge Hub** is a comprehensive web and mobile platform that allows users to ask questions in natural language and receive AI-generated answers enhanced by real-time web search and document analysis. The platform supports topic-scoped AI knowledge, document uploads, subscription management, and embeddable chatbot deployment.

---

## Core Concept

The platform enables users to:
- Ask questions in natural language
- Get AI-generated answers enhanced by real-time web search (Tavily API)
- Upload documents and ask questions about them
- Save and organize queries in threads/collections
- Customize AI knowledge scope per topic
- Deploy AI to their websites via embeddable chatbot or API
- Access premium features via subscription and payments

---

## 1. Core Features

### 1.1 AI-Powered Answering
- **LLM Integration**: Uses OpenAI GPT, Claude, or similar for answer generation
- **Retrieval-Augmented Generation (RAG)**:
  - Retrieves relevant results from Tavily Search API
  - Uses embeddings of uploaded documents stored in Pinecone
  - Combines web search + document embeddings for comprehensive answers
- **Source Attribution**: Answers include citations and source references
- **Conversational Context**: Maintains conversation history and context for follow-up questions

### 1.2 Real-Time Web Search
- **Tavily Search API Integration**: Provides up-to-date search results
- **Topic Filtering**: Search results can be filtered by specific topics
  - Examples: "Politics in Uganda", "Apple Inc.", "Renewable Energy in Kenya"
- **Intelligent Search**: AI combines search results with embeddings to provide accurate answers

### 1.3 Document Upload & Analysis
- **Supported Formats**: PDF, DOCX, Images
- **Text Extraction**: Convert files to text for processing
- **Secure Storage**: Files stored in Supabase Storage with user isolation
- **Embedding Generation**: Create embeddings using LLM
- **Vector Storage**: Store embeddings in Pinecone for semantic search
- **Document Q&A**: Ask questions specifically about uploaded documents
- **Content Summarization**: AI can summarize uploaded document content

### 1.4 User Authentication
- **Custom Email System**:
  - User signup with email/password
  - Login functionality
  - Password reset via email
- **Google OAuth**: One-click login with Google account
- **Future Enhancement**: Two-factor authentication (2FA) for added security
- **Data Isolation**: All user data and files isolated per user using Supabase Auth + Row Level Security (RLS)

### 1.5 Subscription Management & Payments
- **Tiered Subscription System**:
  
  | Tier | Features |
  |------|----------|
  | **Free** | Limited queries per month, basic AI responses |
  | **Premium** | Increased query limits, document uploads, faster responses |
  | **Pro** | Unlimited queries, priority AI, multi-document RAG, advanced features |
  
- **Payment Integration**:
  - **PayPal**: International payment processing
  - **Pesapal**: Regional payment processing for African markets
- **Backend Enforcement**: Usage tracking and subscription enforcement in backend API

### 1.6 Topic-Scoped AI
- **Topic Selection**: Users can select specific topics for AI to focus on
  - Example topics: Politics in Uganda, Renewable Energy in Kenya, Apple Inc.
- **Filtered Search**: Tavily Search queries restricted to selected topic
- **Knowledge Restriction**: AI knowledge and answers scoped to selected topic
- **Document Integration**: Uploaded documents related to topic included in AI answers
- **Multi-Topic Support**: Users can configure and switch between multiple topic scopes

### 1.7 Embeddable Chatbot & Custom API
- **Embeddable Deployment**: Users can deploy their topic-scoped AI to their website
  - **Iframe Embed**: Simple iframe integration
  - **JavaScript Snippet**: Customizable JS widget
- **Custom API Endpoint**: Programmatic access via REST API
  - API key authentication
  - Rate limiting based on subscription tier
- **Customization Options**:
  - Colors and branding
  - Avatar/logo
  - Greeting message
  - UI theme
- **Security**: User/topic isolation and access control enforcement

### 1.8 Organizational Tools
- **Query Threads**: Save related queries and answers in conversation threads
- **Collections**: Organize threads and queries into collections
- **History Tracking**: Complete query history per user
- **Export Functionality**: Export answers to PDF
- **Analytics Dashboard** (Premium Feature):
  - Usage statistics
  - Top queries
  - Document analytics
  - API usage metrics

### 1.9 Advanced Features (Optional / Future)
- **AI Email Assistant**: Send summaries of answers or document insights via email
- **Browser Plugin**: Summarize web pages for users
- **Team Collaboration**: Share topic-scoped bots among team members
- **White-Label Embedding**: Remove branding for Pro users
- **Multi-language Support**: Answer questions in different languages

---

## 2. Technical Architecture

### 2.1 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend** | Node.js + Express / Python FastAPI | API endpoints, AI orchestration, auth, payments |
| **LLM API** | OpenAI GPT / Claude | AI-generated answers |
| **Search API** | Tavily API | Real-time web search with topic filtering |
| **Vector Database** | Pinecone | Store embeddings for documents & topic knowledge |
| **File Storage** | Supabase Storage | Secure file storage with encryption |
| **Database** | Supabase (PostgreSQL) | Users, topics, subscriptions, metadata |
| **Authentication** | Supabase Auth + Google OAuth | User management, multi-login support |
| **Payments** | PayPal + Pesapal | Subscription payments & recurring billing |
| **Frontend** | React / Next.js + Tailwind CSS | Responsive web app with chat interface |
| **Mobile** | React Native / Flutter (Optional) | Mobile application |
| **Hosting** | Vercel / Render / AWS | Serverless deployment, scalability |

### 2.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Web App    │  │ Mobile App   │  │ Embeddable   │     │
│  │  (Next.js)   │  │  (Optional)  │  │   Chatbot    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication & Authorization (Supabase Auth)      │  │
│  │  Subscription & Usage Enforcement                    │  │
│  │  Request Rate Limiting                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AI Orchestration Engine                  │  │
│  │  • LLM API Integration (OpenAI/Claude)               │  │
│  │  • RAG: Pinecone Embeddings + Tavily Search         │  │
│  │  • Topic Filtering & Context Management              │  │
│  │  • Response Generation with Source Attribution       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │   Pinecone   │ │  Tavily API  │
│  PostgreSQL  │ │  Vector DB   │ │  Search API  │
│  + Storage   │ │  Embeddings  │ │ Web Search   │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 2.3 Data Flow: Question Answering Process

```
1. User submits question + topic scope
   │
   ├─► Check authentication & subscription
   │
   ├─► Enforce rate limits
   │
   ├─► Fetch topic-filtered embeddings from Pinecone (user + topic)
   │
   ├─► Search Tavily API (topic-filtered query)
   │
   ├─► Combine:
   │   • Relevant document embeddings
   │   • Tavily search results
   │   • Conversation context
   │
   ├─► Generate answer via LLM API with RAG
   │
   ├─► Return answer with source attribution
   │
   └─► Save query/answer to database for history
```

---

## 3. Multi-Tenant Architecture & User Isolation

### 3.1 Data Isolation Strategy
- **Database Level**: All tables include `user_id` foreign key
- **Row Level Security (RLS)**: Supabase RLS policies enforce user isolation
- **Storage Isolation**: Files in Supabase Storage organized by `user_id`
- **Vector Isolation**: Pinecone embeddings tagged with `user_id + topic_id`

### 3.2 Access Control
- **Authentication Required**: All API endpoints require valid auth token
- **Topic Access**: Users can only access their own configured topics
- **File Access**: Users can only access their own uploaded documents
- **API Keys**: Embeddable bots/API require valid API key tied to user subscription

### 3.3 Embeddable Bot Security
- Each embed gets unique secure token
- Token includes `user_id` and `topic_id`
- Backend validates token on each request
- Rate limiting per subscription tier

---

## 4. Monetization Strategy

| Feature | Monetization Model |
|---------|-------------------|
| **Basic AI Queries** | Free tier with monthly limits |
| **Topic-Scoped AI** | Premium subscription per topic or tier |
| **Document Upload** | Higher-tier subscription required |
| **Embeddable Chatbot** | Extra fee for unlimited embeds / advanced customization |
| **Custom API** | Tiered by API calls per month |
| **Analytics Dashboard** | Premium/Pro feature |
| **White-Label Embedding** | Pro-tier exclusive add-on |
| **Team Collaboration** | Enterprise tier feature |

### 4.1 Pricing Tiers (Suggested)

**Free Tier:**
- 50 queries/month
- Basic AI responses
- No document upload
- No embedding

**Premium ($9.99/month):**
- 500 queries/month
- Document upload (up to 10 files)
- Topic-scoped AI (up to 3 topics)
- Basic embeddable chatbot
- Query history

**Pro ($29.99/month):**
- Unlimited queries
- Unlimited document uploads
- Unlimited topics
- Priority AI processing
- Advanced embeddable chatbot
- Custom API access (1000 calls/month)
- Analytics dashboard
- White-label option

---

## 5. Security & Cost Optimization

### 5.1 Security Measures
- **Data Encryption**: Supabase Storage encryption for files
- **Transport Security**: HTTPS/TLS for all communications
- **Authentication**: Secure token-based auth (JWT)
- **Input Validation**: Sanitize all user inputs
- **Rate Limiting**: Prevent abuse and DDoS
- **API Key Security**: Secure API key generation and storage

### 5.2 Cost Optimization
- **Topic-Filtered Search**: Reduce unnecessary API calls by scoping searches
- **Caching**: Cache frequently accessed embeddings and search results
- **Lifecycle Policies**: Auto-delete old files for free-tier users
- **Rate Limiting**: Enforce subscription-based rate limits
- **Efficient Embeddings**: Reuse embeddings where possible
- **API Call Optimization**: Batch requests when possible

---

## 6. Development Phases

### Phase 1: MVP (Minimum Viable Product)
- User authentication (email/password + Google OAuth)
- Basic AI question answering (LLM API only)
- Simple UI/chat interface
- Database setup (Supabase)

### Phase 2: Core Features
- Tavily search integration
- Document upload and storage
- Pinecone integration for embeddings
- RAG implementation
- Basic subscription system

### Phase 3: Advanced Features
- Topic-scoped AI
- Embeddable chatbot
- Custom API endpoints
- Query history and collections
- Analytics dashboard

### Phase 4: Payments & Monetization
- PayPal integration
- Pesapal integration
- Subscription management
- Usage tracking and enforcement

### Phase 5: Polish & Scale
- Mobile app (optional)
- Advanced features (email assistant, browser plugin)
- Performance optimization
- Scaling and infrastructure

---

## 7. Key Requirements

### 7.1 Functional Requirements
- [x] User can create account and login
- [x] User can ask questions and receive AI answers
- [x] Answers include real-time web search results
- [x] User can upload documents and ask questions about them
- [x] User can configure topic-scoped AI knowledge
- [x] User can embed chatbot on their website
- [x] User can access custom API endpoint
- [x] User can subscribe and make payments
- [x] User data is isolated and secure

### 7.2 Non-Functional Requirements
- Response time: < 5 seconds for AI answers
- Availability: 99.9% uptime
- Scalability: Support 10,000+ concurrent users
- Security: PCI-DSS compliance for payments
- Data privacy: GDPR/CCPA compliance

---

## 8. Success Metrics

- User acquisition and retention
- Query volume and quality
- Subscription conversion rate
- API usage and embed deployments
- User satisfaction and feedback
- Cost per query optimization

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Status:** Planning Phase
