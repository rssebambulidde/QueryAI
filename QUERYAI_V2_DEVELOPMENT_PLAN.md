# QueryAI v2 — Full Development Plan

## Executive Summary

Transform QueryAI from a document-centric RAG/topic research platform into a **two-mode AI assistant** (Deep Research + General Chat) powered by a **pluggable multi-LLM backend** that a super_admin can switch at runtime.

### What's changing

| Area | Current (v1) | Target (v2) |
|---|---|---|
| **Chat modes** | Single mode with Web/Docs toggles | Two distinct modes: Deep Research & General Chat |
| **Documents** | Upload, process, vectorize, search via Pinecone | **Retired** — no document features |
| **Topics** | Research topics with hierarchical tree, off-topic refusal | **Retired** — no topic features |
| **LLM** | OpenAI only (hardcoded gpt-3.5-turbo / gpt-4o-mini) | Pluggable: OpenAI, Anthropic, Google Gemini, Mistral, Groq |
| **LLM Config** | Hardcoded in source, env var for API key only | Admin-configurable at runtime via UI + `system_settings` table |
| **Regeneration** | Broken — missing RAG settings, no streaming | Fixed: full settings, conversation history, streaming |
| **Input area** | Web ✓ / Docs ✓ / Document selector pills | Mode-specific: Research = Web toggle + filters; Chat = clean input |
| **Sidebar** | Conversations + Topic filters + Research Workspace link | Conversations only + mode indicator per conversation |

---

## Phase 1 — Regeneration Fixes (Day 1)

> **Goal**: Fix the broken regeneration feature before architecture changes.

### 1.1 Backend: Store RAG settings in message metadata

**File**: `backend/src/services/ai-answer-pipeline.service.ts`

| Task | Detail |
|---|---|
| In `postProcessStream()`, add `ragSettings` to the metadata object before saving | Include `enableWebSearch`, `enableDocumentSearch`, `maxSearchResults`, `maxDocumentChunks`, `minScore`, `timeRange`, `startDate`, `endDate`, `country`, `topic` from the original request |
| Pass the original request params through `PostProcessStreamParams` | Add `ragSettings?: Record<string,any>` to the `PostProcessStreamParams` interface |

**File**: `backend/src/routes/ai.routes.ts`

| Task | Detail |
|---|---|
| In the `/ask/stream` route handler, pass ragSettings to `postProcessStream()` | Extract from the `request` object and pass as `ragSettings` |
| In the `/regenerate` route handler, read `originalAssistant.metadata.ragSettings` and merge into `mergedRequest` | Gives regeneration the same RAG settings as the original |
| Build `conversationHistory` from messages before the target index | `allMessages.slice(0, assistantIdx).filter(m => m.role === 'user' \|\| m.role === 'assistant').map(m => ({ role: m.role, content: m.content }))` |
| Add `conversationHistory` to `mergedRequest` | Pipe it through to the pipeline for multi-turn context |

### 1.2 Frontend: Fix "Same settings" button

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| Change "Same settings" `onClick` from `{ temperature: 0.8 }` to `{}` | Empty options = no overrides = truly same as original |
| Optional: rename to "Regenerate" since it does the same thing as the main button | Reduces confusion |

### 1.3 Tests

| Task | Detail |
|---|---|
| Update `backend/src/__tests__/ai-service.test.ts` | Mock the new `ragSettings` metadata field |
| Manually test regeneration via UI | Verify RAG settings carry through, conversation history works |

### 1.4 Commit & Deploy

```
git commit -m "fix: regeneration includes RAG settings + conversation history"
```

---

## Phase 2 — Retire Topics & Documents from UI (Days 2–3)

> **Goal**: Hide all topic/document UI and disable routes. Keep backend files intact (safety net).

### 2.1 Frontend: Remove topic UI from sidebar

**File**: `frontend/components/sidebar/app-sidebar.tsx`

| Task | Detail |
|---|---|
| Remove `import { SidebarTopicFilters }` and the `<SidebarTopicFilters />` render | Line 23 import, line 481 render |
| Remove "Research Workspace" button | Lines 330-337 (desktop), lines 451-461 (mobile) |
| Remove `isWorkspacePage` variable | Line 59 |

### 2.2 Frontend: Remove topic/document components from chat

**File**: `frontend/components/chat/chat-input.tsx`

| Task | Detail |
|---|---|
| Remove the Docs ✓ toggle button from pills row | Keep only Web ✓ (will be used in Research mode) |
| Remove `DocumentQuickSelect` import and render | No more document selection |
| Remove props: `docsEnabled`, `onDocsToggle`, `processedDocs`, `selectedDocIds`, `onDocSelectionChange`, `onDocumentDelete` | Clean up interface |

**File**: `frontend/components/chat/chat-input-area.tsx`

| Task | Detail |
|---|---|
| Remove `docsEnabled` / `onDocsToggle` pass-through | No more doc toggle |
| Remove `processedDocs` / `selectedDocIds` / `onDocSelectionChange` / `onDocumentDelete` pass-through | Clean up |
| Always set `enableDocumentSearch: false` in ragSettings | Or remove from ragSettings entirely |

**File**: `frontend/components/chat/chat-container.tsx`

| Task | Detail |
|---|---|
| Remove `documents` / `setDocuments` state | No more doc state |
| Remove `documentInfo` / `setDocumentInfo` state | No more doc count |
| Remove `handleDocumentDelete` function | No more delete |
| Remove `useDocumentUpload` hook usage | No more drag-drop upload |
| Remove `selectedTopic` / topic change detection | No more topic switching |
| Remove `suggestedStarters` fetch for topicId | No topic-based starters |
| Remove `topicApi.get()` call on conversation load | No topic hydration |
| Remove all topic-related imports | TopicCreationModal, ResearchModeBanner, etc. |

**File**: `frontend/components/chat/chat-types.ts` (ChatInputAreaProps)

| Task | Detail |
|---|---|
| Remove `onDocumentDelete`, `processedDocs`, `selectedDocIds`, `onDocSelectionChange`, `docsEnabled`, `onDocsToggle` from props interface | Simplify |

### 2.3 Frontend: Remove topic/document settings pages

**Files to hide/remove content from**:

| File/Page | Action |
|---|---|
| `frontend/app/dashboard/settings/topics/` | Delete entire directory (or render "Feature retired" message) |
| `frontend/app/dashboard/settings/documents/` | Delete entire directory |
| `frontend/app/dashboard/page.tsx` | Remove `documentCount` / `hasProcessedDocuments` loading, remove tab redirects for `documents`/`topics` |
| `frontend/app/workspace/page.tsx` | Render empty state or delete page (was topic/document graph) |
| `frontend/components/settings/search-preferences.tsx` | Remove topic-related dropdown, remove doc-specific settings |
| `frontend/components/chat/unified-filter-panel.tsx` | Remove `TopicCreationModal`, `KeywordTopicSuggestions` imports |

### 2.4 Frontend: Remove additional topic/document components

These files become dead code after the above removals:

| File | Action |
|---|---|
| `frontend/components/chat/document-quick-select.tsx` | Mark as deprecated / delete |
| `frontend/components/chat/docs-only-toggle.tsx` | Delete (already unused import removed) |
| `frontend/components/chat/topic-creation-modal.tsx` | Delete |
| `frontend/components/chat/keyword-topic-suggestions.tsx` | Delete |
| `frontend/components/chat/research-mode-banner.tsx` | Delete |
| `frontend/components/chat/research-mode-bar.tsx` | Delete |
| `frontend/components/chat/research-session-summary-modal.tsx` | Delete |
| `frontend/components/sidebar/sidebar-topic-filters.tsx` | Delete |
| `frontend/components/topics/` (entire directory) | Delete |
| `frontend/components/documents/` (entire directory) | Delete |
| `frontend/components/workspace/research-graph.tsx` | Delete |
| `frontend/lib/api/topics.ts` | Delete |
| `frontend/lib/api/documents.ts` | Delete |
| `frontend/lib/hooks/use-document-upload.ts` | Delete |

### 2.5 Frontend: Clean up stores and API types

**File**: `frontend/lib/store/filter-store.ts`

| Task | Detail |
|---|---|
| Remove `topics[]`, `selectedTopic`, `isLoadingTopics`, `setSelectedTopic()`, `loadTopics()` | No topic filtering |

**File**: `frontend/lib/api.ts`

| Task | Detail |
|---|---|
| Remove `Topic`, `TopicTreeNode`, `TopicAncestor` interfaces | Dead types |
| Remove `topicApi` namespace | No topic API |
| Remove `documentApi` namespace | No document API |
| Remove `searchApi.semantic()` | Was for document search |
| Remove `topicId` from `QuestionRequest` interface | No topics on requests |
| Remove `enableDocumentSearch`, `documentIds`, `maxDocumentChunks`, `minScore` from `QuestionRequest` | No document search |

**File**: `frontend/lib/hooks/useChatSend.ts`

| Task | Detail |
|---|---|
| Remove `topicId`, `enableDocumentSearch`, `documentIds`, `maxDocumentChunks`, `minScore` from request construction | Always web-only or no-search |
| Remove `TOPIC_LIMIT_EXCEEDED` error handling | No topics |

### 2.6 Backend: Disable routes (don't delete files yet)

**File**: `backend/src/server.ts`

| Task | Detail |
|---|---|
| Comment out `import topicsRoutes` and `app.use('/api/topics', topicsRoutes)` | Disable topic API |
| Comment out `import documentsRoutes` and `app.use('/api/documents', documentsRoutes)` | Disable document API |
| Comment out `import searchRoutes` and `app.use('/api/search', searchRoutes)` | Disable semantic search (was for documents) |
| Comment out `import workspaceRoutes` and `app.use('/api/workspace', workspaceRoutes)` | Disable workspace (was topic/doc graph) |

**File**: `backend/src/routes/ai.routes.ts`

| Task | Detail |
|---|---|
| Remove `topicId` from request destructuring in `/ask` and `/ask/stream` | No topics |
| Force `enableDocumentSearch = false` in RAG options | Skip document retrieval |
| Remove off-topic pre-check block in streaming route | No topic-based refusal |
| Remove `/api/ai/research-session-summary` endpoint | Topic feature |
| Remove `/api/ai/suggested-starters` endpoint | Topic feature |

### 2.7 Backend: Simplify RAG pipeline to web-only

**File**: `backend/src/services/rag.service.ts`

| Task | Detail |
|---|---|
| In `retrieveContext()`, skip `topicId` / `ancestorTopicIds` | No topic filtering |
| In `RAGOptions`, mark `enableDocumentSearch`, `documentIds`, `topicId` as always-off | Or remove |
| In `extractSources()`, skip the `documentContexts` loop | Only web sources |

**File**: `backend/src/services/retrieval-orchestrator.service.ts`

| Task | Detail |
|---|---|
| In `orchestrate()`, skip `retrieveDocumentContext()` and `retrieveDocumentContextKeyword()` calls | Only call `retrieveWebSearch()` |
| Remove `topicId` from Pinecone filter / cache key | No topic filtering |

**File**: `backend/src/services/ai-answer-pipeline.service.ts`

| Task | Detail |
|---|---|
| Remove `runOffTopicPreCheckInternal()` calls | No topic refusal |
| Remove topic fetch / ancestor chain logic | No topic scope |
| In `prepareRequestContext()`, skip `TopicService` lazy import and related logic | Simplify |

**File**: `backend/src/services/prompt-builder.service.ts`

| Task | Detail |
|---|---|
| Remove `topicScopeInstruction` / `deriveScopeFromConfig()` usage | No RESEARCH TOPIC MODE |
| Remove DOCUMENT-ONLY mode instruction | No documents |
| Keep web-only instruction as the default context instruction | Always web or none |

### 2.8 Commit & Deploy

```
git commit -m "feat: retire topics and documents features from UI and routes"
```

---

## Phase 3 — Two-Mode System (Days 4–6)

> **Goal**: Implement Deep Research and General Chat as two distinct conversation modes.

### 3.1 Database: Add mode column to conversations

**File**: `backend/src/database/migrations/037_add_conversation_mode.sql`

```sql
-- Add conversation mode: 'research' = web RAG + citations, 'chat' = general knowledge
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'research';
ALTER TABLE conversations ADD CONSTRAINT conversations_mode_check CHECK (mode IN ('research', 'chat'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations (mode);
```

### 3.2 Backend: Conversation mode support

**File**: `backend/src/types/database.ts`

| Task | Detail |
|---|---|
| Add `mode: 'research' \| 'chat'` to `Conversation` interface | Type safety |

**File**: `backend/src/services/conversation.service.ts`

| Task | Detail |
|---|---|
| Accept `mode` in `createConversation()` | Stored on creation, immutable afterward |
| Return `mode` in `getConversation()` | Frontend reads it |

**File**: `backend/src/routes/conversations.routes.ts`

| Task | Detail |
|---|---|
| Accept `mode` in POST body for conversation creation | Validated as `'research' \| 'chat'` |

### 3.3 Backend: Mode-aware AI pipeline

**File**: `backend/src/routes/ai.routes.ts`

| Task | Detail |
|---|---|
| In `/ask/stream`, read the `mode` from the request body (frontend sends it) | Or look up conversation's mode from DB |
| If `mode === 'chat'`: skip RAG entirely, skip source emission, skip quality scoring, skip citation validation | Straight LLM call with history |
| If `mode === 'research'`: current web-search RAG flow (unchanged) | Full pipeline |

**File**: `backend/src/services/ai-answer-pipeline.service.ts`

| Task | Detail |
|---|---|
| Add `mode?: 'research' \| 'chat'` to `QuestionRequest` type | Mode flows through pipeline |
| In `prepareRequestContext()`, if `mode === 'chat'`: skip RAG context, use a simpler system prompt | No sources, no citations |
| Create new method `buildChatSystemPrompt()` | Conversational, no citation rules, no source formatting |

**File**: `backend/src/services/prompt-builder.service.ts`

| Task | Detail |
|---|---|
| Add `buildChatPrompt(conversationHistory)` method | Simple system prompt: "You are a helpful AI assistant. Be concise, accurate, and conversational." |
| No citation rules, no source formatting, no JSON structured output | Plain text response |

### 3.4 Frontend: Mode selection on empty state

**File**: `frontend/components/chat/chat-container.tsx`

| Task | Detail |
|---|---|
| Add `conversationMode` state: `'research' \| 'chat' \| null` | null = not yet chosen (empty state) |
| When a conversation is loaded, read `mode` from conversation data | Set `conversationMode` |
| When no conversation is selected (empty state), show mode selection cards | Two cards: Deep Research / General Chat |
| On card click: create a new conversation with selected mode, then show input | `conversationApi.create({ mode: '...' })` |

**New Component**: `frontend/components/chat/mode-selector.tsx`

```
┌─────────────────────────────────────────────────┐
│                                                   │
│          How would you like to chat?              │
│                                                   │
│  ┌──────────────────┐  ┌──────────────────┐      │
│  │  🔍 Deep          │  │  💬 General       │      │
│  │     Research      │  │     Chat          │      │
│  │                    │  │                    │      │
│  │  Web-powered AI   │  │  Fast AI answers   │      │
│  │  with cited       │  │  from general      │      │
│  │  sources          │  │  knowledge         │      │
│  │                    │  │                    │      │
│  │  Best for:        │  │  Best for:         │      │
│  │  • Fact-checking  │  │  • Quick questions  │      │
│  │  • Current events │  │  • Brainstorming    │      │
│  │  • Research       │  │  • Writing help     │      │
│  └──────────────────┘  └──────────────────┘      │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 3.5 Frontend: Mode-specific input area

**File**: `frontend/components/chat/chat-input-area.tsx`

| Task | Detail |
|---|---|
| Accept `mode` prop | Determines which controls to show |
| If `mode === 'research'`: show Web toggle, time/country filters, Attach button | Current Research experience |
| If `mode === 'chat'`: show **only** the textarea + Send button | Clean, minimal input |
| If `mode === 'chat'`: hide all RAG toggles, filters, file upload | No RAG in chat mode |

**File**: `frontend/components/chat/chat-input.tsx`

| Task | Detail |
|---|---|
| Accept `mode` prop | Controls pill visibility |
| If `mode === 'chat'`: render no pills row, just textarea + send button | Minimal |
| If `mode === 'research'`: render Web ✓ pill + filter toggles | Current layout minus Docs |

### 3.6 Frontend: Mode-specific message rendering

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| Accept `mode` prop (or derive from whether sources exist) | Controls citation UI |
| If `mode === 'chat'`: hide citation badge, hide sources breakdown, hide regenerate button | Simple chat bubbles |
| If `mode === 'research'`: show full citation UI, sources badge, regenerate | Current experience |

**File**: `frontend/components/chat/chat-message-list.tsx`

| Task | Detail |
|---|---|
| Pass `mode` prop through to each `<ChatMessage>` | From container state |

### 3.7 Frontend: Mode indicator in sidebar conversation list

**File**: `frontend/components/chat/conversation-item.tsx`

| Task | Detail |
|---|---|
| Show a small icon next to conversation title | 🔍 for research, 💬 for chat |
| Use `conversation.mode` from API response | Icon selection |

### 3.8 Frontend: General Chat response format

**File**: `frontend/components/chat/enhanced-content-processor.tsx`

| Task | Detail |
|---|---|
| If no `sources` prop (chat mode): skip citation parsing entirely | Just render markdown directly |
| Saves processing time for chat messages | No regex scanning |

### 3.9 Backend: Chat mode streaming

**File**: `backend/src/routes/ai.routes.ts` (streaming route)

| Task | Detail |
|---|---|
| If `mode === 'chat'`: skip RAG retrieval, skip source SSE event, skip quality scoring | Emit only: chunks → follow-ups → done |
| Build messages with simple chat system prompt + conversation history | No RAG context |
| Still use structured JSON output for follow-ups extraction | Consistent parsing |

### 3.10 Frontend: Remove follow-ups in chat mode

| Task | Detail |
|---|---|
| In `follow-up-questions.tsx`: optionally hide or show based on `mode` | Research: show. Chat: optional (could keep for UX) |

### 3.11 Commit & Deploy

```
git commit -m "feat: two-mode system — Deep Research and General Chat"
```

---

## Phase 4 — Multi-LLM Provider Abstraction (Days 7–9)

> **Goal**: Create a provider abstraction layer so the app can use any LLM.

### 4.1 Backend: Provider interface

**New File**: `backend/src/providers/llm-provider.interface.ts`

```typescript
export interface LLMProvider {
  readonly id: string;          // 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq'
  readonly displayName: string;
  readonly supportedModels: ModelInfo[];

  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  chatCompletionStream(params: ChatCompletionParams): AsyncGenerator<string, ChatStreamMeta, unknown>;
}

export interface ModelInfo {
  id: string;                   // 'gpt-4o-mini', 'claude-sonnet-4-20250514', etc.
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  capabilities: ('chat' | 'structured_output' | 'vision')[];
  isDefault?: boolean;
}

export interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string;
}

export interface ChatStreamMeta {
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}
```

### 4.2 Backend: OpenAI provider (wraps existing logic)

**New File**: `backend/src/providers/openai.provider.ts`

| Task | Detail |
|---|---|
| Implement `LLMProvider` interface | Wraps existing `openai.chat.completions.create()` |
| `chatCompletion()` → non-streaming call | Returns parsed result |
| `chatCompletionStream()` → async generator | Yields delta content strings, returns meta on completion |
| Move `OpenAIPool` monitoring into this provider | Encapsulate connection management |
| Handle `response_format: { type: 'json_object' }` when `responseFormat === 'json'` | OpenAI-specific structured output |
| Supported models: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`, `o1-mini`, `o3-mini` | With pricing data |

### 4.3 Backend: Anthropic provider

**New File**: `backend/src/providers/anthropic.provider.ts`

| Task | Detail |
|---|---|
| `npm install @anthropic-ai/sdk` | Add dependency |
| Implement `LLMProvider` interface | Wraps `anthropic.messages.create()` |
| Map `messages` format: Anthropic uses `system` as a top-level param, not in the messages array | Provider translates |
| For JSON output: add "Respond in JSON" to system prompt (Anthropic doesn't have native `response_format`) | Provider handles |
| Streaming: use `stream: true` → yields `content_block_delta` events | Map to plain string chunks |
| Supported models: `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` | With pricing data |

### 4.4 Backend: Google Gemini provider

**New File**: `backend/src/providers/google.provider.ts`

| Task | Detail |
|---|---|
| `npm install @google/generative-ai` | Add dependency |
| Implement `LLMProvider` | Wraps `model.generateContent()` |
| Map message format: Gemini uses `{ role: 'user' \| 'model', parts: [{ text }] }` | Provider translates |
| Streaming: `generateContentStream()` → yields text chunks | Map to plain strings |
| Supported models: `gemini-2.0-flash`, `gemini-2.0-pro` | With pricing data |

### 4.5 Backend: Groq provider (fast inference)

**New File**: `backend/src/providers/groq.provider.ts`

| Task | Detail |
|---|---|
| `npm install groq-sdk` | Add dependency |
| Implement `LLMProvider` | Groq uses OpenAI-compatible API format |
| Very similar to OpenAI provider but different base URL and models | Fast inference |
| Supported models: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` | With pricing data |

### 4.6 Backend: Provider Registry

**New File**: `backend/src/providers/provider-registry.ts`

```typescript
export class ProviderRegistry {
  private static providers = new Map<string, LLMProvider>();
  private static activeConfig: { providerId: string; modelId: string };
  private static chatConfig: { providerId: string; modelId: string };     // for General Chat mode
  private static researchConfig: { providerId: string; modelId: string }; // for Deep Research mode

  static register(provider: LLMProvider): void;
  static getForMode(mode: 'research' | 'chat'): { provider: LLMProvider; model: string };
  static setActiveConfig(mode: 'research' | 'chat', providerId: string, modelId: string): void;
  static listProviders(): Array<{ id: string; displayName: string; models: ModelInfo[]; configured: boolean }>;
  static async loadFromDatabase(): Promise<void>;  // reads system_settings on startup
  static async persistToDatabase(key: string, value: any): Promise<void>;
}
```

| Task | Detail |
|---|---|
| On server startup, register all providers (OpenAI, Anthropic, Google, Groq) | Conditional on API key presence |
| Load active config from `system_settings` table | Falls back to OpenAI gpt-4o-mini |
| `getForMode('research')` / `getForMode('chat')` | Returns provider+model — different per mode |

### 4.7 Backend: Migrate services to use ProviderRegistry

**Priority services to migrate** (these make the main LLM calls):

| Service | Current | Migration |
|---|---|---|
| `ai-answer-pipeline.service.ts` (non-streaming) | `openai.chat.completions.create(...)` | `ProviderRegistry.getForMode(mode).provider.chatCompletion(...)` |
| `ai-answer-pipeline.service.ts` (streaming) | `openai.chat.completions.create({ stream: true })` | `ProviderRegistry.getForMode(mode).provider.chatCompletionStream(...)` |
| `response-processor.service.ts` | `openai.chat.completions.create(...)` for follow-ups | `ProviderRegistry.getForMode('chat').provider.chatCompletion(...)` |
| `ai-generation.service.ts` | `openai.chat.completions.create(...)` for summaries/essays | `ProviderRegistry.getForMode('chat').provider.chatCompletion(...)` |

**Lower-priority services** (support functions, migrate later):

| Service | Notes |
|---|---|
| `query-expansion.service.ts` | Cheap calls, can stay OpenAI |
| `query-rewriter.service.ts` | Cheap calls, can stay OpenAI |
| `query-decomposer.service.ts` | Cheap calls, can stay OpenAI |
| `conversation-state.service.ts` | Can stay OpenAI |
| `conversation-summarizer.service.ts` | Can stay OpenAI |
| `context-summarizer.service.ts` | Can stay OpenAI |
| `answer-evaluator.service.ts` | Judge calls, can stay OpenAI |
| `few-shot-selector.service.ts` | Can stay OpenAI |

### 4.8 Backend: Update JSON stream parser for non-OpenAI providers

**File**: `backend/src/utils/json-stream-parser.ts`

| Task | Detail |
|---|---|
| Existing `JsonAnswerStreamParser` works on raw JSON deltas | Provider-agnostic: each provider's `chatCompletionStream()` yields plain text already |
| No change needed if providers yield clean answer text | If structured output: provider handles JSON extraction internally |

### 4.9 Backend: Update cost tracking

**File**: `backend/src/services/cost-tracking.service.ts`

| Task | Detail |
|---|---|
| Replace hardcoded `OPENAI_PRICING` dict | Read from `ProviderRegistry.listProviders()` → each model has `inputCostPer1M`/`outputCostPer1M` |
| Update `calculateCost(model, usage)` | Look up pricing from provider registry |

### 4.10 Commit & Deploy

```
git commit -m "feat: multi-LLM provider abstraction layer"
```

---

## Phase 5 — Admin Settings & LLM Management UI (Days 10–12)

> **Goal**: Super admin can configure LLM providers, models, and API keys at runtime.

### 5.1 Database: system_settings table

**File**: `backend/src/database/migrations/038_system_settings.sql`

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service-role can read/write (accessed via supabaseAdmin)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Initial settings
INSERT INTO system_settings (key, value) VALUES
  ('llm_provider_research', '{"providerId": "openai", "modelId": "gpt-4o-mini"}'),
  ('llm_provider_chat', '{"providerId": "openai", "modelId": "gpt-4o-mini"}'),
  ('llm_api_keys', '{}'),
  ('llm_defaults', '{"temperature": 0.7, "maxTokens": 4096}'),
  ('feature_flags', '{"deepResearchEnabled": true, "generalChatEnabled": true}')
ON CONFLICT (key) DO NOTHING;
```

### 5.2 Backend: SystemSettings service

**New File**: `backend/src/services/system-settings.service.ts`

```typescript
export class SystemSettingsService {
  static async get(key: string): Promise<any>;
  static async set(key: string, value: any, updatedBy: string): Promise<void>;
  static async getAll(): Promise<Record<string, any>>;
}
```

| Task | Detail |
|---|---|
| `get(key)` → `supabaseAdmin.from('system_settings').select('value').eq('key', key).single()` | Returns parsed JSONB |
| `set(key, value, updatedBy)` → upsert | Stores value + audit trail |
| Cache in-memory with 60s TTL | Avoid hitting DB on every request |

### 5.3 Backend: Admin LLM routes

**File**: `backend/src/routes/admin.routes.ts` (add new endpoints)

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/settings/llm` | GET | Returns current provider config, available providers, models |
| `/api/admin/settings/llm` | PUT | Update provider + model for a mode (research/chat) |
| `/api/admin/settings/llm/api-keys` | PUT | Set API keys per provider (stored encrypted) |
| `/api/admin/settings/llm/test` | POST | Test a provider + model connection (send "Hello" and check response) |
| `/api/admin/settings/llm/defaults` | PUT | Update default temperature, max tokens |

All routes behind `requireSuperAdmin` middleware.

### 5.4 Frontend: Admin API

**File**: `frontend/lib/api.ts`

| Task | Detail |
|---|---|
| Add `adminApi.getLLMSettings()` | `GET /api/admin/settings/llm` |
| Add `adminApi.updateLLMSettings(mode, providerId, modelId)` | `PUT /api/admin/settings/llm` |
| Add `adminApi.updateLLMApiKeys(keys)` | `PUT /api/admin/settings/llm/api-keys` |
| Add `adminApi.testLLMConnection(providerId, modelId)` | `POST /api/admin/settings/llm/test` |
| Add `adminApi.updateLLMDefaults(defaults)` | `PUT /api/admin/settings/llm/defaults` |

### 5.5 Frontend: LLM Settings page

**New File**: `frontend/components/super-admin/llm-settings.tsx`

**New Page**: `frontend/app/dashboard/settings/super-admin/llm/page.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  LLM Configuration                            [Save]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Deep Research Mode                                      │
│  ┌─────────────────────────┐  ┌─────────────────────┐   │
│  │ Provider: [OpenAI    ▾] │  │ Model: [gpt-4o-mini ▾│   │
│  └─────────────────────────┘  └─────────────────────┘   │
│                                                          │
│  General Chat Mode                                       │
│  ┌─────────────────────────┐  ┌─────────────────────┐   │
│  │ Provider: [Anthropic ▾] │  │ Model: [claude-sono ▾│   │
│  └─────────────────────────┘  └─────────────────────┘   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  API Keys                                                │
│                                                          │
│  OpenAI      [sk-••••••••••••••] [✓ Connected]           │
│  Anthropic   [sk-ant-•••••••••] [Test Connection]        │
│  Google      [AIza•••••••••••] [Not configured]          │
│  Groq        [gsk_•••••••••••] [Not configured]          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Defaults                                                │
│                                                          │
│  Temperature:  [═══════●════] 0.7                        │
│  Max Tokens:   [4096        ]                            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Model Info                                              │
│  ┌──────────────┬────────┬─────────┬──────────────┐     │
│  │ Model        │Context │ In $/1M │ Out $/1M     │     │
│  ├──────────────┼────────┼─────────┼──────────────┤     │
│  │ gpt-4o-mini  │128K    │ $0.15   │ $0.60        │     │
│  │ claude-sono  │200K    │ $3.00   │ $15.00       │     │
│  │ gemini-2.0f  │1M      │ $0.10   │ $0.40        │     │
│  │ llama-3.3-70 │128K    │ $0.59   │ $0.79        │     │
│  └──────────────┴────────┴─────────┴──────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5.6 Frontend: Show model label on messages

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| Show model name under assistant messages (small gray text) | e.g. "gpt-4o-mini" or "claude-sonnet-4" |
| Read from `message.metadata.model` | Already stored during save |

### 5.7 Frontend: Admin sidebar link

**File**: `frontend/components/sidebar/app-sidebar.tsx`

| Task | Detail |
|---|---|
| Existing 🔧 super-admin button → navigates to `/dashboard/settings/super-admin` | Add LLM settings as a section |
| In the super-admin settings page, add "LLM Configuration" card/link | Points to the new page |

### 5.8 Commit & Deploy

```
git commit -m "feat: admin LLM configuration UI and runtime provider switching"
```

---

## Phase 6 — Backend Cleanup & Database Migration (Days 13–15)

> **Goal**: Delete retired code, drop unused tables, clean external resources.

### 6.1 Backend: Delete retired service files

| Files to DELETE | Count |
|---|---|
| `topic.service.ts`, `topic-query-builder.service.ts` | 2 |
| `document.service.ts`, `document-processing.service.ts`, `document-type-detection.service.ts` | 3 |
| `extraction.service.ts`, `chunk.service.ts`, `chunking.service.ts`, `semantic-chunking.service.ts` | 4 |
| `embedding.service.ts` (if no longer needed for query embedding either) | 1 |
| `pinecone.service.ts`, `keyword-search.service.ts`, `bm25-index.service.ts` | 3 |
| `hybrid-search.service.ts`, `deduplication.service.ts`, `diversity-filter.service.ts` | 3 |
| `processing-progress.service.ts` | 1 |
| **Total** | **17 services** |

| Routes/Config to DELETE | |
|---|---|
| `topics.routes.ts`, `documents.routes.ts`, `document.controller.ts` | 3 |
| `config/pinecone.ts`, `config/chunking.config.ts` | 2 |
| `scripts/migrate-embeddings.ts` | 1 |

| Tests to DELETE | |
|---|---|
| All topic/document/pinecone/chunking/keyword-search tests | ~15 files |

### 6.2 Database migration: Drop tables

**File**: `backend/src/database/migrations/039_drop_topics_documents.sql`

```sql
-- Drop topic and document tables (Phase 6 cleanup)
-- IMPORTANT: This is irreversible. Run AFTER verifying Phase 2 works correctly.

-- Drop FK constraints first
ALTER TABLE conversations DROP COLUMN IF EXISTS topic_id;
ALTER TABLE feedback DROP COLUMN IF EXISTS topic_id;
ALTER TABLE quality_evaluations DROP COLUMN IF EXISTS topic_id;
ALTER TABLE cited_sources DROP COLUMN IF EXISTS document_id;
ALTER TABLE cited_sources DROP COLUMN IF EXISTS topic_id;

-- Drop tables
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS topics CASCADE;

-- Drop related RPCs
DROP FUNCTION IF EXISTS get_feedback_by_topic CASCADE;

-- Revoke/cleanup
-- (add specific REVOKE statements based on existing grants)
```

### 6.3 External cleanup

| Resource | Action |
|---|---|
| Pinecone index | Delete the index (saves ~$70/month on Starter) |
| Supabase Storage `documents` bucket | Delete all files |
| Railway env vars | Remove `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`, `PINECONE_INDEX` |

### 6.4 Backend: Clean remaining references

| File | Task |
|---|---|
| `config/thresholds.config.ts` | Remove `PineconeConfig`, document-related thresholds |
| `services/degradation.service.ts` | Remove `PINECONE` from service types |
| `services/error-tracker.service.ts` | Remove `PINECONE` from service types |
| `services/storage.service.ts` | Remove document methods (keep avatar methods) |
| `services/subscription.service.ts` | Remove `documentUploads`, `maxTopics`, limit checks |
| `middleware/subscription.middleware.ts` | Remove `enforceTopicLimit`, `enforceDocumentUploadLimit` |
| `types/database.ts` | Remove `Topic`, `Document`, `DocumentChunk` interfaces |

### 6.5 Commit & Deploy

```
git commit -m "chore: delete retired topic/document services and drop tables"
```

---

## Phase 7 — Streaming Regeneration (Day 16)

> **Goal**: Regeneration uses SSE streaming like the main ask flow.

### 7.1 Backend: Streaming regenerate endpoint

**File**: `backend/src/routes/ai.routes.ts`

| Task | Detail |
|---|---|
| Change `/regenerate` from JSON POST to SSE stream | Same pattern as `/ask/stream` |
| Set SSE headers, run `answerQuestionStreamInternal()`, yield chunks | Result: streaming answer during regeneration |
| After stream: create new message version (same as current) | Save to DB, return version info in final SSE event |
| New SSE event type `version` at end of stream | `{ version: N, messageId, versions: [...] }` |

### 7.2 Frontend: Streaming regeneration

**File**: `frontend/lib/api.ts`

| Task | Detail |
|---|---|
| Add `aiApi.regenerateStream(messageId, conversationId, options)` | Returns `AsyncGenerator` like `askStream` |

**File**: `frontend/lib/hooks/useChatSend.ts`

| Task | Detail |
|---|---|
| Update `regenerateMessage()` to use `regenerateStream()` | Stream chunks into the existing message, update content progressively |
| Handle `version` SSE event to update version pills | Apply version state |

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| During regeneration: show streaming content in-place | Instead of spinner → full text replacement |
| After stream completes: update version pills | Same as current post-regen behavior |

### 7.3 Commit & Deploy

```
git commit -m "feat: streaming regeneration with SSE"
```

---

## Phase 8 — Polish & Enhancements (Days 17–19)

### 8.1 Citation badge: Use structured citedSources

**File**: `backend/src/services/ai-answer-pipeline.service.ts`

| Task | Detail |
|---|---|
| In `postProcessStream()`, store `structuredMeta.citedSources` in message metadata | `metadata.citedSources = structuredMeta?.citedSources` |

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| In `citationCount` memo: prefer `message.metadata?.citedSources?.length` over regex | More accurate |
| Keep regex as fallback for messages without structured metadata | Backward compatibility |

### 8.2 Model display on messages

**File**: `frontend/components/chat/chat-message.tsx`

| Task | Detail |
|---|---|
| Add small model label below assistant message timestamp | "via gpt-4o-mini" or "via claude-sonnet-4" |
| Read from message metadata (`message.metadata?.model`) | Already persisted |
| Light gray, 10px, only on hover or always | Design decision |

### 8.3 Provider health on admin dashboard

**File**: `frontend/components/super-admin/health-monitoring.tsx`

| Task | Detail |
|---|---|
| Add "LLM Provider" section | Show active provider, last response time, error rate |
| Pull from `/api/connections` health check (already exists) | Extend with per-provider stats |

### 8.4 Smart mode suggestion

**File**: `frontend/components/chat/chat-input.tsx`

| Task | Detail |
|---|---|
| If `mode === 'chat'` and user types research-like keywords ("latest", "2025", "current news", "source", "evidence") | Show subtle hint |
| Hint: "This might benefit from Deep Research mode" with one-click to create new research conversation | UX improvement |

### 8.5 Simplified subscription tiers

**File**: `backend/src/services/subscription.service.ts`

| Task | Detail |
|---|---|
| Remove `maxTopics`, `documentUploads` from tier limits | Already retired |
| Simplify to: `queriesPerMonth`, `maxCollections`, `allowResearchMode` | Clean limits |

**Free tier**: General Chat only, X queries/month
**Pro tier**: Both modes, unlimited queries (or higher limit)

---

## File Inventory — Summary

### New Files to Create

| File | Phase |
|---|---|
| `backend/src/database/migrations/037_add_conversation_mode.sql` | 3 |
| `backend/src/database/migrations/038_system_settings.sql` | 5 |
| `backend/src/database/migrations/039_drop_topics_documents.sql` | 6 |
| `backend/src/providers/llm-provider.interface.ts` | 4 |
| `backend/src/providers/openai.provider.ts` | 4 |
| `backend/src/providers/anthropic.provider.ts` | 4 |
| `backend/src/providers/google.provider.ts` | 4 |
| `backend/src/providers/groq.provider.ts` | 4 |
| `backend/src/providers/provider-registry.ts` | 4 |
| `backend/src/services/system-settings.service.ts` | 5 |
| `frontend/components/chat/mode-selector.tsx` | 3 |
| `frontend/components/super-admin/llm-settings.tsx` | 5 |
| `frontend/app/dashboard/settings/super-admin/llm/page.tsx` | 5 |

### Files to Modify (Key Ones)

| File | Phases |
|---|---|
| `backend/src/routes/ai.routes.ts` | 1, 2, 3, 7 |
| `backend/src/services/ai-answer-pipeline.service.ts` | 1, 2, 3, 4, 8 |
| `backend/src/services/prompt-builder.service.ts` | 2, 3 |
| `backend/src/services/rag.service.ts` | 2 |
| `backend/src/services/retrieval-orchestrator.service.ts` | 2 |
| `backend/src/services/conversation.service.ts` | 2, 3 |
| `backend/src/routes/conversations.routes.ts` | 3 |
| `backend/src/routes/admin.routes.ts` | 5 |
| `backend/src/services/cost-tracking.service.ts` | 4 |
| `backend/src/server.ts` | 2 |
| `frontend/components/chat/chat-container.tsx` | 2, 3 |
| `frontend/components/chat/chat-input.tsx` | 2, 3 |
| `frontend/components/chat/chat-input-area.tsx` | 2, 3 |
| `frontend/components/chat/chat-message.tsx` | 1, 3, 7, 8 |
| `frontend/components/chat/chat-types.ts` | 2, 3 |
| `frontend/components/sidebar/app-sidebar.tsx` | 2, 5 |
| `frontend/lib/api.ts` | 2, 5 |
| `frontend/lib/hooks/useChatSend.ts` | 1, 2, 3, 7 |
| `frontend/lib/store/filter-store.ts` | 2 |
| `frontend/app/dashboard/page.tsx` | 2, 3 |

### Files to Delete (Phase 6)

**Backend** (~38 files):
- 17 service files (topic, document, pinecone, chunking, etc.)
- 3 route/controller files
- 2 config files
- 1 script file
- ~15 test files

**Frontend** (~18 files/directories):
- `components/topics/` directory
- `components/documents/` directory
- 8 individual component files (topic-creation-modal, document-quick-select, etc.)
- 3 API/hook files
- `app/dashboard/settings/topics/` directory
- `app/dashboard/settings/documents/` directory

---

## Timeline Summary

| Phase | Duration | Description |
|---|---|---|
| **1** | Day 1 | Regeneration fixes |
| **2** | Days 2–3 | Retire topics & documents from UI |
| **3** | Days 4–6 | Two-mode system (Research + Chat) |
| **4** | Days 7–9 | Multi-LLM provider abstraction |
| **5** | Days 10–12 | Admin settings + LLM management UI |
| **6** | Days 13–15 | Backend cleanup + DB migration |
| **7** | Day 16 | Streaming regeneration |
| **8** | Days 17–19 | Polish (citation badge, model labels, smart suggestions) |
| | **19 working days** | **Total estimated timeline** |

---

## Git Strategy

All work on `feature/v2-two-mode-multi-llm` branch from `development`:

```
development
  └── feature/v2-two-mode-multi-llm
        ├── commit: "fix: regeneration includes RAG settings"               (Phase 1)
        ├── commit: "feat: retire topics and documents from UI"             (Phase 2)
        ├── commit: "feat: two-mode system — Deep Research + General Chat"  (Phase 3)
        ├── commit: "feat: multi-LLM provider abstraction layer"            (Phase 4)
        ├── commit: "feat: admin LLM config UI + runtime switching"         (Phase 5)
        ├── commit: "chore: delete retired topic/document code + tables"    (Phase 6)
        ├── commit: "feat: streaming regeneration with SSE"                 (Phase 7)
        └── commit: "polish: citations, model labels, smart suggestions"   (Phase 8)
```

Merge to `development` after each phase passes testing. Merge `development` → `main` for production releases.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Breaking existing conversations that have topic_id | Medium | Phase 2 soft-disables; Phase 6 drops column (nullable, safe) |
| Existing messages reference Document citations | Low | Citations stay in text as-is; just no longer interactive |
| Provider switch mid-conversation (different model styles) | Medium | Store model on each message; UI shows which model answered |
| Anthropic/Google structured output differences | Medium | Provider layer abstracts; each provider handles JSON internally |
| Admin changes LLM during active streams | Low | Registry returns config at stream start; mid-stream switches don't affect running streams |
| Pinecone billing continues after feature retirement | Low | Phase 6 explicitly deletes index |
