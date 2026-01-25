# Phase 2.7: Conversation Management - Implementation Plan

**Date:** 2025-01-27  
**Status:** 📋 Planning  
**Priority:** High

---

## 🎯 Overview

Implement conversation management to allow users to:
- Create and manage multiple conversation threads
- Save conversation history to the database
- Name and organize conversations
- Switch between conversations
- View conversation list in the UI

---

## 📊 Current State Analysis

### ✅ What Already Exists

1. **Database Schema:**
   - `conversations` table exists with: `id`, `user_id`, `topic_id`, `title`, `created_at`, `updated_at`
   - `messages` table exists with: `id`, `conversation_id`, `role`, `content`, `sources`, `metadata`, `created_at`
   - RLS policies are already configured for both tables
   - Indexes are in place for performance

2. **Type Definitions:**
   - `Database.Conversation` interface exists
   - `Database.Message` interface exists

3. **Frontend:**
   - Chat interface exists but stores messages only in local state
   - Dashboard has sidebar that could host conversation list
   - No conversation persistence or switching currently

### ❌ What's Missing

1. **Backend Services:**
   - Conversation service (CRUD operations)
   - Message service (save/retrieve messages)
   - Auto-title generation for conversations

2. **Backend API Endpoints:**
   - `GET /api/conversations` - List user's conversations
   - `POST /api/conversations` - Create new conversation
   - `GET /api/conversations/:id` - Get conversation details
   - `PUT /api/conversations/:id` - Update conversation (rename)
   - `DELETE /api/conversations/:id` - Delete conversation
   - `GET /api/conversations/:id/messages` - Get messages for conversation
   - `POST /api/conversations/:id/messages` - Save message to conversation

3. **Frontend Components:**
   - Conversation list sidebar component
   - Conversation item component
   - Conversation switching logic
   - Auto-save messages to database
   - Conversation naming/renaming UI

4. **State Management:**
   - Current conversation ID tracking
   - Conversation list state
   - Message persistence state

---

## 🏗️ Architecture Design

### Database Schema (Already Exists)

```sql
-- Conversations table (already exists)
conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  topic_id UUID REFERENCES topics(id),
  title TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Messages table (already exists)
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  sources JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

### Data Flow

```
User sends message
  ↓
Frontend: Save to local state (immediate UI update)
  ↓
Backend: Process with RAG/AI
  ↓
Backend: Save user message + assistant response to database
  ↓
Frontend: Update conversation list if new conversation
  ↓
Frontend: Update conversation title (auto-generated from first message)
```

---

## 📋 Implementation Plan

### Phase 1: Backend Services & API (Foundation)

#### 1.1 Create Conversation Service
**File:** `backend/src/services/conversation.service.ts`

**Methods:**
- `createConversation(userId, title?, topicId?)` - Create new conversation
- `getConversation(conversationId, userId)` - Get conversation by ID
- `getUserConversations(userId, limit?, offset?)` - List user's conversations
- `updateConversation(conversationId, userId, updates)` - Update conversation (rename)
- `deleteConversation(conversationId, userId)` - Delete conversation
- `generateTitleFromMessage(message)` - Auto-generate title from first message

**Features:**
- Auto-generate title from first user message (truncate to 50 chars)
- Update `updated_at` timestamp when messages are added
- Sort conversations by `updated_at` DESC (most recent first)

#### 1.2 Create Message Service
**File:** `backend/src/services/message.service.ts`

**Methods:**
- `saveMessage(conversationId, role, content, sources?, metadata?)` - Save message
- `getMessages(conversationId, userId, limit?, offset?)` - Get messages for conversation
- `saveMessagePair(conversationId, userMessage, assistantMessage, sources?)` - Save user + assistant pair
- `deleteMessage(messageId, userId)` - Delete single message
- `deleteConversationMessages(conversationId, userId)` - Delete all messages in conversation

**Features:**
- Store sources as JSONB
- Store metadata (model used, tokens, etc.) as JSONB
- Validate conversation ownership before saving

#### 1.3 Create API Routes
**File:** `backend/src/routes/conversations.routes.ts`

**Endpoints:**
```
GET    /api/conversations              - List user's conversations
POST   /api/conversations              - Create new conversation
GET    /api/conversations/:id          - Get conversation details
PUT    /api/conversations/:id          - Update conversation (rename)
DELETE /api/conversations/:id          - Delete conversation
GET    /api/conversations/:id/messages - Get messages for conversation
POST   /api/conversations/:id/messages - Save message to conversation
```

**Request/Response Examples:**
```typescript
// POST /api/conversations
Request: { title?: string, topicId?: string }
Response: { success: true, data: Conversation }

// GET /api/conversations
Response: { success: true, data: Conversation[] }

// PUT /api/conversations/:id
Request: { title: string }
Response: { success: true, data: Conversation }

// POST /api/conversations/:id/messages
Request: { role: 'user' | 'assistant', content: string, sources?: Source[], metadata?: object }
Response: { success: true, data: Message }
```

#### 1.4 Update AI Service Integration
**File:** `backend/src/services/ai.service.ts`

**Changes:**
- Accept `conversationId` in `QuestionRequest`
- After generating response, save both user message and assistant response
- Auto-create conversation if `conversationId` not provided
- Update conversation `updated_at` timestamp

---

### Phase 2: Frontend State Management

#### 2.1 Create Conversation Store
**File:** `frontend/lib/store/conversation-store.ts` (Zustand)

**State:**
```typescript
interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearCurrentConversation: () => void;
}
```

**Features:**
- Persist `currentConversationId` to localStorage
- Auto-load conversations on mount
- Cache conversations in memory
- Optimistic updates for better UX

#### 2.2 Update Chat Interface State
**File:** `frontend/components/chat/chat-interface.tsx`

**Changes:**
- Integrate with conversation store
- Load messages from database when conversation selected
- Save messages to database after AI response
- Auto-create conversation on first message
- Update conversation title from first message

---

### Phase 3: Frontend UI Components

#### 3.1 Conversation List Sidebar
**File:** `frontend/components/chat/conversation-list.tsx`

**Features:**
- Display list of conversations
- Show conversation title, last message preview, timestamp
- Highlight active conversation
- "New Conversation" button at top
- Search/filter conversations
- Sort by recent/oldest
- Delete conversation (with confirmation)

**UI Design:**
```
┌─────────────────────────────┐
│ [+ New Conversation]        │
├─────────────────────────────┤
│ 🔍 [Search...]              │
├─────────────────────────────┤
│ 💬 Loan Appraisal Policy    │
│    What is the process...   │
│    2 hours ago              │
├─────────────────────────────┤
│ 💬 Credit Procedures        │
│    How can someone use...   │
│    1 day ago                │
├─────────────────────────────┤
│ 💬 Motor Vehicle Security   │
│    What does this policy... │
│    3 days ago               │
└─────────────────────────────┘
```

#### 3.2 Conversation Item Component
**File:** `frontend/components/chat/conversation-item.tsx`

**Features:**
- Display conversation title
- Show last message preview (truncated)
- Show relative timestamp (e.g., "2 hours ago")
- Click to select conversation
- Context menu (rename, delete)
- Active state styling

#### 3.3 Conversation Header
**File:** `frontend/components/chat/conversation-header.tsx`

**Features:**
- Display current conversation title
- Edit title inline (click to edit)
- Delete conversation button
- Conversation metadata (message count, created date)

#### 3.4 Update Dashboard Layout
**File:** `frontend/app/dashboard/page.tsx`

**Changes:**
- Add conversation list to sidebar when chat tab is active
- Three-column layout: Sidebar | Conversation List | Chat Interface
- Or: Sidebar | Chat Interface (with conversation list as overlay/drawer)

**Layout Options:**

**Option A: Three-Column Layout**
```
┌──────┬──────────────┬──────────────────┐
│ Nav  │ Conversations│   Chat Interface  │
│      │   List       │                   │
│      │              │                   │
└──────┴──────────────┴──────────────────┘
```

**Option B: Collapsible Conversation List**
```
┌──────┬─────────────────────────────────┐
│ Nav  │ [☰] Chat Interface              │
│      │                                 │
│      │ (Conversation list as drawer)  │
└──────┴─────────────────────────────────┘
```

**Recommended: Option A** - Better UX, always visible

---

### Phase 4: Auto-Save & Title Generation

#### 4.1 Auto-Save Messages
**Implementation:**
- After AI response completes, save both messages to database
- Use `saveMessagePair` for atomic operation
- Handle errors gracefully (don't block UI)
- Show save status indicator

#### 4.2 Auto-Generate Titles
**Implementation:**
- When first message is sent, create conversation with auto-generated title
- Extract first 50 characters from first user message
- Clean up title (remove special chars, truncate)
- Allow user to rename later

**Title Generation Logic:**
```typescript
function generateTitle(message: string): string {
  // Remove markdown, special chars
  let title = message
    .replace(/[#*_`]/g, '')
    .replace(/\n/g, ' ')
    .trim();
  
  // Truncate to 50 chars
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  // Fallback if empty
  return title || 'New Conversation';
}
```

---

## 🔄 User Flows

### Flow 1: Starting a New Conversation
1. User clicks "New Conversation" or sends first message
2. Frontend creates conversation (or uses existing if none selected)
3. User sends message → Saved to database
4. AI responds → Saved to database
5. Conversation title auto-generated from first message
6. Conversation appears in list

### Flow 2: Switching Conversations
1. User clicks conversation in list
2. Frontend loads conversation messages from database
3. Messages displayed in chat interface
4. User can continue conversation
5. New messages saved to same conversation

### Flow 3: Renaming Conversation
1. User clicks edit icon on conversation
2. Inline edit mode activated
3. User types new title
4. Frontend updates conversation via API
5. Conversation list refreshes

### Flow 4: Deleting Conversation
1. User clicks delete icon on conversation
2. Confirmation dialog appears
3. User confirms deletion
4. Frontend deletes conversation via API
5. If deleted conversation was active, switch to "New Conversation"
6. Conversation list refreshes

---

## 📁 File Structure

### Backend Files to Create
```
backend/src/
├── services/
│   ├── conversation.service.ts      [NEW]
│   └── message.service.ts            [NEW]
├── routes/
│   └── conversations.routes.ts      [NEW]
└── types/
    └── conversation.ts              [NEW - if needed]
```

### Backend Files to Modify
```
backend/src/
├── services/
│   └── ai.service.ts                [MODIFY - add conversation saving]
├── routes/
│   └── ai.routes.ts                 [MODIFY - accept conversationId]
└── server.ts                        [MODIFY - register conversation routes]
```

### Frontend Files to Create
```
frontend/
├── components/
│   └── chat/
│       ├── conversation-list.tsx    [NEW]
│       ├── conversation-item.tsx    [NEW]
│       └── conversation-header.tsx  [NEW]
└── lib/
    ├── store/
    │   └── conversation-store.ts   [NEW]
    └── api.ts                       [MODIFY - add conversation API methods]
```

### Frontend Files to Modify
```
frontend/
├── components/
│   └── chat/
│       └── chat-interface.tsx       [MODIFY - integrate with conversations]
├── app/
│   └── dashboard/
│       └── page.tsx                 [MODIFY - add conversation list]
└── lib/
    └── api.ts                       [MODIFY - add conversation types]
```

---

## 🎨 UI/UX Design

### Conversation List Design

**Layout:**
- Fixed width sidebar (250-300px)
- Scrollable list
- Search bar at top
- "New Conversation" button prominent
- Each item: Title, preview, timestamp
- Active conversation highlighted

**Interactions:**
- Click conversation → Load messages
- Hover → Show actions (edit, delete)
- Right-click → Context menu
- Drag to reorder? (Future enhancement)

### Conversation Header Design

**In Chat Interface:**
- Show conversation title (editable)
- Show metadata (message count, date)
- Actions: Rename, Delete, Share (future)

### Empty States

**No Conversations:**
- "Start a new conversation to get started"
- "New Conversation" button

**No Messages in Conversation:**
- "This conversation is empty"
- "Send a message to start"

---

## 🔒 Security Considerations

1. **RLS Policies:** Already configured, verify they work correctly
2. **User Isolation:** Ensure users can only access their own conversations
3. **Input Validation:** Sanitize conversation titles and messages
4. **Rate Limiting:** Limit conversation creation rate
5. **Message Size Limits:** Enforce max message length

---

## 📊 Database Considerations

### Indexes (Already Exist)
- `idx_conversations_user_id` - Fast user conversation lookup
- `idx_messages_conversation_id` - Fast message retrieval

### Additional Indexes (If Needed)
- `idx_conversations_updated_at` - For sorting by recent
- `idx_messages_created_at` - For message ordering

### Performance
- Pagination for conversations list (limit 20-50 per page)
- Pagination for messages (load last 50, load more on scroll)
- Lazy load conversation details

---

## 🧪 Testing Checklist

### Backend Tests
- [ ] Create conversation
- [ ] List user conversations
- [ ] Get conversation by ID
- [ ] Update conversation title
- [ ] Delete conversation
- [ ] Save messages to conversation
- [ ] Retrieve messages for conversation
- [ ] Auto-generate conversation title
- [ ] RLS policies enforce user isolation
- [ ] Handle missing conversation gracefully

### Frontend Tests
- [ ] Load conversations on mount
- [ ] Create new conversation
- [ ] Switch between conversations
- [ ] Save messages to database
- [ ] Load messages when switching
- [ ] Rename conversation
- [ ] Delete conversation
- [ ] Auto-generate title from first message
- [ ] Handle empty states
- [ ] Handle errors gracefully

### Integration Tests
- [ ] End-to-end: Create conversation → Send message → Save → Switch → Load
- [ ] Multiple users isolation
- [ ] Concurrent conversation creation
- [ ] Large conversation handling (100+ messages)

---

## 🚀 Implementation Phases

### Phase 1: Backend Foundation (Week 1)
1. Create conversation service
2. Create message service
3. Create API routes
4. Update AI service to save messages
5. Test backend endpoints

### Phase 2: Frontend State & API (Week 1-2)
1. Create conversation store
2. Add conversation API methods
3. Update chat interface to use store
4. Test state management

### Phase 3: UI Components (Week 2)
1. Create conversation list component
2. Create conversation item component
3. Create conversation header
4. Update dashboard layout
5. Test UI interactions

### Phase 4: Integration & Polish (Week 2)
1. Integrate auto-save
2. Implement title generation
3. Add error handling
4. Add loading states
5. Final testing

---

## 📝 API Specification

### Conversation Endpoints

#### GET /api/conversations
**Description:** List user's conversations

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Loan Appraisal Policy",
      "created_at": "2025-01-27T10:00:00Z",
      "updated_at": "2025-01-27T12:00:00Z",
      "messageCount": 5,
      "lastMessage": "What is the process..."
    }
  ]
}
```

#### POST /api/conversations
**Description:** Create new conversation

**Request:**
```json
{
  "title": "Optional Title",
  "topicId": "optional-topic-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "New Conversation",
    "created_at": "2025-01-27T10:00:00Z",
    "updated_at": "2025-01-27T10:00:00Z"
  }
}
```

#### PUT /api/conversations/:id
**Description:** Update conversation (rename)

**Request:**
```json
{
  "title": "New Title"
}
```

#### DELETE /api/conversations/:id
**Description:** Delete conversation and all messages

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted"
}
```

#### GET /api/conversations/:id/messages
**Description:** Get messages for conversation

**Query Params:** `limit`, `offset`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is...",
      "sources": [],
      "created_at": "2025-01-27T10:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "According to...",
      "sources": [...],
      "created_at": "2025-01-27T10:00:01Z"
    }
  ]
}
```

#### POST /api/conversations/:id/messages
**Description:** Save message to conversation

**Request:**
```json
{
  "role": "user",
  "content": "Message content",
  "sources": [...],
  "metadata": {...}
}
```

---

## 🎯 Success Criteria

1. ✅ Users can create multiple conversations
2. ✅ Conversations are saved to database
3. ✅ Messages are persisted per conversation
4. ✅ Users can switch between conversations
5. ✅ Conversation list displays all user conversations
6. ✅ Conversations can be renamed
7. ✅ Conversations can be deleted
8. ✅ Conversation titles auto-generate from first message
9. ✅ Messages load when switching conversations
10. ✅ New messages save to current conversation

---

## 🔮 Future Enhancements (Out of Scope)

1. **Conversation Sharing:** Share conversations with other users
2. **Conversation Export:** Export conversations as PDF/JSON
3. **Conversation Search:** Full-text search across conversations
4. **Conversation Tags:** Tag and categorize conversations
5. **Conversation Folders:** Organize conversations in folders
6. **Message Editing:** Edit sent messages
7. **Message Reactions:** Add reactions to messages
8. **Conversation Templates:** Pre-filled conversation starters
9. **Conversation Analytics:** Stats on conversation usage
10. **Conversation Archiving:** Archive old conversations

---

## 📚 References

- Existing database schema: `backend/src/database/migrations/001_initial_schema.sql`
- RLS policies: `backend/src/database/migrations/002_row_level_security.sql`
- Type definitions: `backend/src/types/database.ts`
- Current chat interface: `frontend/components/chat/chat-interface.tsx`

---

**Next Steps:**
1. Review and approve this plan
2. Start with Phase 1 (Backend Foundation)
3. Iterate based on feedback

**Estimated Timeline:** 1-2 weeks for full implementation

---

**Last Updated:** 2025-01-27
