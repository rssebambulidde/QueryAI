# Phase 3 Advanced Features - Complete Explanation

## Overview

Phase 3 introduces three major advanced features that extend QueryAI's capabilities:
1. **Topic-Scoped AI** - Scope AI queries to specific topics/domains
2. **Custom API with API Keys** - Programmatic access with authentication
3. **Embeddable Chatbot** - Deploy topic-scoped chatbots on external websites

---

## 1. Topic-Scoped AI

### What It Does
Allows users to create and manage **topics** that scope AI queries to specific domains. When a topic is selected, all queries are filtered to that topic's context.

### How It Works

#### **Topic Creation & Management**
- Users create topics (e.g., "Bank of Uganda", "Politics in Uganda", "Renewable Energy")
- Each topic has:
  - **Name**: The topic identifier
  - **Description**: Optional description
  - **Scope Config**: JSON configuration for future customization

#### **Topic Selection in Conversations**
- Users can select a topic when starting or during a conversation
- The selected topic is saved to the conversation (`conversation.topic_id`)
- Topic selection appears as a badge in the chat interface

#### **Topic-Based Filtering**

**1. Document Filtering:**
```
User selects "Bank of Uganda" topic
↓
When querying documents, only documents tagged with this topic_id are searched
↓
Pinecone vector search filters by topicId metadata
↓
Only relevant documents from "Bank of Uganda" are returned
```

**2. Web Search Filtering:**
```
User query: "What are the latest job openings?"
Topic: "Bank of Uganda"
↓
Search query becomes: "Bank of Uganda" + "latest job openings"
↓
Tavily API searches with topic context
↓
Results are post-filtered to ensure "Bank of Uganda" appears in content
```

**3. AI Prompt Context:**
```
System prompt includes:
"TOPIC SCOPE: You are currently operating within the topic scope of 'Bank of Uganda'.
All your responses should be focused on this specific topic domain."
↓
AI generates responses focused on the selected topic
```

### Example Flow

```
1. User creates topic: "Bank of Uganda"
2. User uploads documents about Bank of Uganda (tagged with topic_id)
3. User starts conversation and selects "Bank of Uganda" topic
4. User asks: "What are the latest job openings?"
5. System:
   - Searches only Bank of Uganda documents
   - Web searches for "Bank of Uganda" + "latest job openings"
   - AI responds with Bank of Uganda-specific information
```

### Database Structure
```sql
topics table:
- id (UUID)
- user_id (UUID) - Owner of the topic
- name (TEXT) - "Bank of Uganda"
- description (TEXT) - Optional
- scope_config (JSONB) - Future customization

conversations table:
- topic_id (UUID) - Links to selected topic
```

---

## 2. Custom API with API Keys

### What It Does
Provides programmatic access to QueryAI via REST API using API key authentication. Each API key can be scoped to a specific topic.

### How It Works

#### **API Key Creation**
1. User creates an API key in the dashboard
2. System generates a secure key: `qai_<64-character-hex-string>`
3. Key is hashed (SHA-256) and stored in database
4. Only the prefix (`qai_xxxxx`) is shown after creation
5. Full key is shown **once** on creation (user must save it)

#### **API Key Properties**
- **Name**: User-friendly identifier
- **Topic Scope**: Optional - restricts all queries to this topic
- **Rate Limits**: 
  - Per hour (default: 100 requests)
  - Per day (default: 1000 requests)
- **Expiration**: Optional expiration date
- **Status**: Active/Inactive toggle

#### **Authentication Flow**
```
Client Request:
  Headers:
    Authorization: Bearer qai_abc123...
    OR
    X-API-Key: qai_abc123...
↓
Backend validates:
  1. Hash the provided key
  2. Look up hash in database
  3. Check if key is active
  4. Check if key is expired
  5. Verify rate limits
↓
If valid:
  - Attach apiKey, userId, topicId to request
  - Process request
  - Log usage
```

#### **API Endpoints**

**1. POST /api/v1/ask** (Non-streaming)
```json
Request:
{
  "question": "What are the latest job openings?",
  "conversationHistory": [...],
  "model": "gpt-4",
  "temperature": 0.7
}

Response:
{
  "success": true,
  "data": {
    "answer": "Based on recent information...",
    "sources": [...],
    "model": "gpt-4",
    "usage": {...}
  }
}
```

**2. POST /api/v1/ask/stream** (Streaming)
- Same request format
- Returns Server-Sent Events (SSE) stream
- Format: `data: {"chunk": "text..."}\n\n`

**3. GET /api/v1/health**
- Returns API key status and rate limit info

#### **Topic-Based Access Control**
```
API Key with topic_id = "bank-of-uganda-id"
↓
All requests automatically scoped to this topic
↓
User cannot query other topics with this key
↓
Documents filtered by topic_id
Web search filtered by topic name
AI responses focused on topic
```

#### **Rate Limiting**
```
Request arrives
↓
Check usage in last hour
Check usage in last day
↓
If limits exceeded:
  Return 429 (Rate Limit Exceeded)
  Include: remainingPerHour, remainingPerDay
↓
If within limits:
  Process request
  Log usage to api_key_usage table
```

#### **Usage Tracking**
Every API call is logged:
- API key ID
- Endpoint
- Method
- Status code
- Response time
- Timestamp

This enables analytics and monitoring.

---

## 3. Embeddable Chatbot

### What It Does
Allows users to create embeddable chatbot widgets that can be deployed on external websites. Each chatbot is scoped to a specific topic.

### How It Works

#### **Embedding Configuration Creation**
1. User selects a topic (e.g., "Bank of Uganda")
2. User creates an embedding configuration:
   - **Name**: "Bank of Uganda Support Bot"
   - **Customization**:
     - Primary color (default: orange)
     - Background color
     - Text color
     - Greeting message
     - Avatar/logo URL
     - Theme (light/dark)
     - Show/hide branding

3. System generates:
   - **Embed Code**: HTML/JavaScript snippet
   - **Config ID**: Unique identifier for the embedding

#### **Embedding Widget**

**Embed Code Example:**
```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://api.queryai.com/embed/script.js';
    script.setAttribute('data-config-id', 'embed_123456');
    script.setAttribute('data-api-url', 'https://api.queryai.com');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
```

#### **How the Widget Works**

**1. Public Embedding Endpoint:**
```
GET /api/embed/:configId
↓
Loads embedding configuration
↓
Verifies topic exists and is active
↓
Serves HTML page with:
  - Customized styling (colors, theme)
  - Chatbot UI
  - JavaScript for interaction
```

**2. Chatbot Interface:**
- Full-screen chat interface
- Custom colors and branding
- Topic name displayed in header
- Greeting message
- Input field and send button

**3. Question Handling:**
```
User types question in embedded widget
↓
JavaScript sends POST to: /api/embed/:configId/ask
{
  "question": "What are the latest job openings?"
}
↓
Backend:
  1. Loads embedding config
  2. Gets topic_id from config
  3. Scopes query to topic
  4. Processes with AI service
  5. Returns response
↓
Widget displays answer
```

#### **Topic Scoping in Embeddings**
```
Embedding Config:
  topic_id: "bank-of-uganda-id"
  user_id: "user-123"
↓
All questions from this widget:
  - Only search documents tagged with "bank-of-uganda-id"
  - Web search filtered by "Bank of Uganda"
  - AI responses focused on Bank of Uganda
↓
User cannot ask about other topics
```

#### **Customization Options**
```javascript
{
  primaryColor: "#f97316",      // Orange (default)
  secondaryColor: "#ea580c",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  avatarUrl: "https://...",
  greetingMessage: "Hello! How can I help?",
  theme: "light",                // or "dark"
  showBranding: true             // Show "Powered by QueryAI"
}
```

#### **Security & Access Control**
- Embedding configs are public (no auth required to view)
- But queries are scoped to the topic
- User's documents are still protected (only accessible via their user_id)
- Each embedding is tied to a specific user and topic

---

## Integration Flow Example

### Complete Scenario: Bank of Uganda Support Bot

**Step 1: Setup**
```
1. User creates topic: "Bank of Uganda"
2. User uploads Bank of Uganda documents (tagged with topic_id)
3. User creates API key scoped to "Bank of Uganda" topic
4. User creates embedding config for "Bank of Uganda" topic
```

**Step 2: Website Integration**
```
Website owner adds embed code to their site:
<script src=".../embed/script.js" data-config-id="embed_123"></script>
```

**Step 3: User Interaction**
```
Visitor on website asks: "What are the latest job openings?"
↓
Widget sends to: POST /api/embed/embed_123/ask
{
  "question": "What are the latest job openings?"
}
↓
Backend:
  1. Loads config (topic_id = "bank-of-uganda-id")
  2. Searches only Bank of Uganda documents
  3. Web searches: "Bank of Uganda" + "latest job openings"
  4. AI generates response focused on Bank of Uganda
↓
Response displayed in widget
```

**Step 4: Programmatic Access (Alternative)**
```
Developer uses API key:
POST /api/v1/ask
Headers:
  Authorization: Bearer qai_abc123...
Body:
{
  "question": "What are the latest job openings?"
}
↓
Backend:
  1. Validates API key (scoped to "Bank of Uganda")
  2. Automatically applies topic filter
  3. Returns Bank of Uganda-specific answer
```

---

## Security Features

### 1. Topic-Based Isolation
- Each topic belongs to a user
- Users can only access their own topics
- API keys are scoped to specific topics
- Embeddings are scoped to specific topics

### 2. API Key Security
- Keys are hashed (SHA-256) before storage
- Full key shown only once on creation
- Keys can be deactivated without deletion
- Expiration dates supported
- Rate limiting prevents abuse

### 3. Row-Level Security (RLS)
- Database policies ensure users only see their own:
  - Topics
  - API keys
  - Embedding configs
- Service role has full access for backend operations

### 4. Usage Tracking
- All API calls logged
- Rate limit enforcement
- Analytics for monitoring

---

## Benefits

### For End Users
1. **Focused Queries**: Get answers specific to their domain
2. **Better Organization**: Separate conversations by topic
3. **Reusable Configurations**: Save topic settings for future use

### For Developers
1. **Programmatic Access**: Integrate QueryAI into their applications
2. **Topic Scoping**: Ensure API responses stay on-topic
3. **Rate Limiting**: Control usage and costs

### For Website Owners
1. **Customizable Widgets**: Match their brand
2. **Topic-Specific Bots**: Deploy specialized chatbots
3. **No Backend Required**: Just add embed code

---

## Technical Architecture

### Database Tables
```
api_keys:
  - Stores API keys (hashed)
  - Links to topics
  - Rate limit settings

embedding_configs:
  - Stores widget configurations
  - Links to topics
  - Customization settings

topics:
  - User-defined topics
  - Scope configuration
```

### Services
```
TopicService:
  - CRUD operations for topics
  - Topic validation

ApiKeyService:
  - Key generation (secure random)
  - Key validation
  - Rate limit checking
  - Usage logging

EmbeddingConfigService:
  - Config management
  - Embed code generation
```

### Middleware
```
apiKeyAuth:
  - Validates API keys
  - Checks rate limits
  - Attaches user/topic context

logApiKeyUsage:
  - Logs API usage
  - Tracks response times
```

---

## Use Cases

### 1. Corporate Knowledge Base
- Create topic: "Company Policies"
- Upload policy documents
- Deploy widget on intranet
- Employees ask questions about policies

### 2. Customer Support
- Create topic: "Product Support"
- Upload product documentation
- Deploy widget on website
- Customers get instant support

### 3. Research Assistant
- Create topic: "Renewable Energy in Kenya"
- Upload research papers
- Use API to query programmatically
- Build custom research tools

### 4. News Monitoring
- Create topic: "Bank of Uganda"
- Set up API key with rate limits
- Schedule queries via cron job
- Monitor for new information

---

## Summary

These features work together to provide:
- **Topic Scoping**: Focus AI on specific domains
- **API Access**: Programmatic integration
- **Embeddable Widgets**: Easy website integration
- **Security**: Topic-based isolation and rate limiting
- **Customization**: Branding and styling options

All features are interconnected - topics scope everything, API keys provide programmatic access, and embeddings make it easy to deploy on websites.
