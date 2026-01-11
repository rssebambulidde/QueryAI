# QueryAI - AI Knowledge Hub

An AI-powered knowledge platform that enables users to ask questions in natural language and receive comprehensive answers enhanced by real-time web search and document analysis. Features include topic-scoped AI, document uploads, embeddable chatbots, and subscription-based monetization.

## 🎯 Project Overview

QueryAI is a comprehensive web and mobile platform that combines:
- **AI-Powered Answering** with LLM integration (OpenAI/Claude)
- **Real-Time Web Search** via Tavily API
- **Document Analysis** with RAG (Retrieval-Augmented Generation)
- **Topic-Scoped AI** for focused knowledge domains
- **Embeddable Chatbots** for website integration
- **Subscription Management** with PayPal and Pesapal payments

## 📚 Documentation

Comprehensive project documentation is available:

- **[Project Specification](./PROJECT_SPECIFICATION.md)** - Complete feature list and requirements
- **[Tech Stack](./TECH_STACK.md)** - Detailed technology choices and dependencies
- **[Architecture](./ARCHITECTURE.md)** - System design and data flow diagrams
- **[Development Roadmap](./DEVELOPMENT_ROADMAP.md)** - Phased development plan

## 🏗️ Project Structure

```
QueryAI/
├── PROJECT_SPECIFICATION.md  # Features and requirements
├── TECH_STACK.md             # Technology choices
├── ARCHITECTURE.md           # System architecture
├── DEVELOPMENT_ROADMAP.md    # Development phases
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Python 3.11+
- Git
- Supabase account
- OpenAI API key
- Tavily API key
- Pinecone account

### Development Workflow

1. Clone the repository
   ```bash
   git clone https://github.com/rssebambulidde/QueryAI.git
   cd QueryAI
   ```

2. Checkout the development branch
   ```bash
   git checkout development
   ```

3. Create a feature branch from development
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and commit
5. Push to development branch or create a pull request

### Branch Strategy

- **main**: Production branch for stable releases
- **development**: Development branch for active work and integration
- **feature/***: Individual feature branches for specific features or fixes

All new features should be developed in the `development` branch. Only stable, tested code should be merged to `main`.

## 🔧 Tech Stack

### Backend
- Node.js + Express or Python FastAPI
- Supabase (PostgreSQL + Auth + Storage)
- Pinecone (Vector Database)
- OpenAI/Claude (LLM APIs)
- Tavily (Search API)

### Frontend
- Next.js + React
- Tailwind CSS
- TypeScript

### Payments
- PayPal
- Pesapal

## 📋 Current Status

**Phase:** Planning & Documentation ✅

- [x] Project setup and repository initialization
- [x] Comprehensive documentation
- [ ] Phase 1: MVP Development
- [ ] Phase 2: Core Features
- [ ] Phase 3: Advanced Features
- [ ] Phase 4: Payments & Monetization
- [ ] Phase 5: Polish & Scale

See [Development Roadmap](./DEVELOPMENT_ROADMAP.md) for detailed progress.

## 🤝 Contributing

This is a private repository. Development follows the branch strategy outlined above.

## 📝 License

[To be determined]

## 🔗 Links

- **Repository**: https://github.com/rssebambulidde/QueryAI
- **Documentation**: See documentation files in root directory
