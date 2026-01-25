# Research Topic Mode – Function Workflow Summary

This document summarises the **function workflows** of all implemented Research Topic Mode features: data flow, decisions, and component interactions.

---

## 1. Entering Research Mode (4.1, 4.3)

**Trigger:** User selects a topic in the sidebar or creates and selects a new topic.

| Step | Component | Action |
|------|-----------|--------|
| 1 | `SidebarTopicFilters` | `handleTopicSelect(topic)` → `setSelectedTopic(topic)`, `setUnifiedFilters(prev => ({ ...prev, topicId, topic }))` |
| 2 | `SidebarTopicFilters` | If `currentConversationId`: `conversationApi.update(conversationId, { topicId: topic?.id })` |
| 3 | `ResearchModeBanner` | Renders when `selectedTopic != null`: "Research mode: {name}", tooltip `description`, "Exit research mode" |
| 4 | `ChatInterface` | Suggested starters (6.1) and `handleSend` include `topicId` / `topic` in requests |

**Store:** `useFilterStore`: `selectedTopic`, `unifiedFilters.topicId`, `unifiedFilters.topic`.

---

## 2. Sending a Question (Research Mode On)

**Trigger:** User submits from `ChatInput` or a "Try:" starter chip.

### 2.1 Frontend: `handleSend` (chat-interface)

| Step | Action |
|------|--------|
| 1 | Build `QuestionRequest`: `topicId: activeFilters.topicId \|\| activeFilters.topic?.id`, plus `topic`, `timeRange`, `startDate`, `endDate`, `country`, RAG options |
| 2 | Create conversation if needed; `createConversation(title, activeFilters.topicId)` |
| 3 | `updateConversationFilters(conversationId, searchFilters)` |
| 4 | Append user message to `messages` |
| 5 | Call `aiApi.askStream(request)` and iterate chunks |

### 2.2 Streaming: `aiApi.askStream` (api.ts)

| Step | Action |
|------|--------|
| 1 | `POST /api/ai/ask/stream` with `QuestionRequest` (includes `topicId`) |
| 2 | Parse SSE: `data: { chunk }` → `yield chunk`; `data: { followUpQuestions, refusal }` → `yield { followUpQuestions, refusal }`; `data: { done }` → return |

### 2.3 Backend: `POST /api/ai/ask/stream` (ai.routes.ts)

| Step | Action |
|------|--------|
| 1 | Destructure `req.body` (question, topicId, timeRange, startDate, endDate, country, RAG options) and build `QuestionRequest` |
| 2 | **Off-topic pre-check (before RAG):** if `topicId` → `TopicService.getTopic` → `topicName`, `topicDescription`, `scope_config` |
| 3 | If `preCheckEnabled` (topicName, `ENABLE_OFF_TOPIC_PRE_CHECK !== 'false'`, `scope_config.enable_off_topic_pre_check !== false`): `AIService.runOffTopicPreCheck(question, topicName, topicDescription, scope_config)` |
| 4 | If pre-check says **off-topic:** `getRefusalMessage`, `getRefusalFollowUp` → write SSE: `{ chunk: refusal }`, `{ followUpQuestions: [followUp], refusal: true }`, `{ done: true }`; `MessageService.saveMessagePair(..., { followUpQuestions, isRefusal: true })`; **RAG and main model are not called (13.1)** |
| 5 | If on-topic or pre-check disabled: `RAGService.retrieveContext` (documents + web, with `topicId`, time/country filters) |
| 6 | `AIService.answerQuestionStream(request, userId)` → stream text chunks |
| 7 | Parse `fullAnswer` for `FOLLOW_UP_QUESTIONS`; send `{ followUpQuestions }` |
| 8 | `MessageService.saveMessagePair(conversationId, question, fullAnswer, sources, { followUpQuestions, ... })` |

### 2.4 `AIService.answerQuestion` (non‑streaming) and `answerQuestionStream`

| Step | Action |
|------|--------|
| 1 | If `request.topicId` and `userId`: `TopicService.getTopic` → `topicName`, `topicDescription`, `topicScopeConfig` |
| 2 | **answerQuestion only – Pre-check:** same condition as route; if off-topic → return `{ answer: refusal, followUpQuestions: [followUp], refusal: true, sources: [] }`, save with `isRefusal: true`; no RAG |
| 3 | **answerQuestionStream:** Pre-check is done in the route; here only: RAG retrieve → `buildMessages` (includes topic block) |
| 4 | `buildMessages` → `buildSystemPrompt(..., topicName, topicDescription, topicScopeConfig)` |

### 2.5 `buildSystemPrompt` (topic block, 2.1, 5.1, 12.1)

| Condition | Instruction |
|-----------|-------------|
| No `topicName` | No topic block |
| `topicName` and `topicScopeConfig?.strict !== false` | **Strict:** "Research Topic Mode", "MUST answer only on-topic", "REFUSE off-topic" (short refusal, no/one meta follow-up), scope from `description` + `deriveScopeFromConfig(scope_config)` (keywords, subtopics) |
| `topicName` and `topicScopeConfig?.strict === false` | **Soft:** "Topic scope", "prioritise topic", no "refuse off-topic" |

---

## 3. Off-Topic Pre-Check (8.1–8.3, 13.1)

**When:** `topicId` set, `ENABLE_OFF_TOPIC_PRE_CHECK !== 'false'`, `scope_config.enable_off_topic_pre_check !== false`.

### `AIService.runOffTopicPreCheck(question, topicName, topicDescription?, scope_config?)`

| Step | Action |
|------|--------|
| 1 | `deriveScopeFromConfig(scope_config)` → "Scope includes: keywords: ...; subtopics: ..." |
| 2 | LLM prompt: "Topic: {name}. Description: {desc}.{scope}\n\nQuestion: {q}\n\nIs this question clearly within the topic? Answer only YES or NO." (cheap model, max_tokens 10) |
| 3 | If normalized answer starts with `NO` → return `false` (off-topic); else `true`. On error → `true` (proceed). |

### `getRefusalMessage(topicName)`, `getRefusalFollowUp(topicName)`

- Refusal: "I'm currently in Research Topic Mode and limited to **{topicName}**. Your question seems outside this scope. You can ask about {topicName} or disable research mode to ask anything."
- Follow-up: "Would you like to ask something about {topicName}?"

---

## 4. Frontend: Processing Streamed Response (11.1)

**In `handleSend` (chat-interface):**

| Chunk type | Action |
|------------|--------|
| `string` | Append to `assistantMessage.content`, `setMessages` |
| `{ followUpQuestions, refusal }` | `followUpQuestions` = list; if `refusal` then `isRefusal = true` |
| On stream end | Set `assistantMessage.followUpQuestions`, `assistantMessage.isRefusal`, `isStreaming: false`; if `FOLLOW_UP_QUESTIONS` in content, strip and parse |

**Fallback (non‑streaming):** `assistantMessage.isRefusal = fallbackResponse.data?.refusal ? true : undefined`.

**Loading from API:** `mapApiMessagesToUi`: `isRefusal: msg.metadata?.isRefusal`.

---

## 5. Refusal Hint (11.2)

**In `ChatMessage`:**

| Condition | UI |
|-----------|-----|
| `!isUser` and `selectedTopicName` and (`message.isRefusal` or (`REFUSAL_PATTERN.test(content)` and `content.length < 500`)) | Hint: "This question seems outside **{topicName}**. Ask something about {topicName} or [exit research mode] to ask anything." |
| `onExitResearchMode` provided | "exit research mode" is a button calling `onExitResearchMode` |

`REFUSAL_PATTERN`: `/outside|limited to|disable research mode|research (mode|topic)/i`

---

## 6. On-Topic Suggested Starters (6.1)

### 6.1.1 TopicManager (create/update)

| Field | Stored as |
|-------|-----------|
| "Suggested starter questions" (textarea, one per line) | `scope_config.suggested_starters: string[]` |
| "Research mode only (refuse off-topic)" | `scope_config.strict: boolean` (default true) |

Create: `scopeConfig: { suggested_starters, strict }`. Update: merge into `scope_config`.

### 6.1.2 ChatInterface

| Condition | Chips |
|-----------|--------|
| `selectedTopic` set | "Try:" + buttons from `scope_config?.suggested_starters` (up to 4) or fallbacks: "What are the key concepts in {name}?", "How does {name} work in practice?" |
| Click | `handleSend(q)` |

---

## 7. Exit Research Mode and Research Session Summary (7.1)

### 7.1.1 `handleExitResearchMode` (chat-interface)

| Condition | Action |
|-----------|--------|
| `currentConversationId` and `selectedTopic` and `messages.some(m => m.role === 'assistant' && (m.content?.length \|\| 0) > 100)` | `setShowResearchSummaryModal(true)` |
| Else | `setSelectedTopic(null)` |

`ResearchModeBanner` receives `onExit={handleExitResearchMode}` so "Exit research mode" uses this.

### 7.1.2 `ResearchSessionSummaryModal`

| Phase | Behaviour |
|-------|-----------|
| `offer` | "Summarise this research session?" Create a short research report for "{topicName}"? [No] [Yes] |
| `loading` | [Yes] → `onRequestSummary()` (see below) |
| `result` | Show `summary`; [Copy] [Close] |
| `onClose` / [No] / [Close] | `handleCloseResearchSummaryModal` → `setShowResearchSummaryModal(false)`, `setSelectedTopic(null)` |

### 7.1.3 `onRequestSummary` (chat-interface)

`aiApi.researchSessionSummary(currentConversationId, selectedTopic.name)` → `POST /api/ai/research-session-summary` with `{ conversationId, topicName }`.

### 7.1.4 Backend: `POST /api/ai/research-session-summary`

`AIService.generateResearchSessionSummary(conversationId, userId, topicName)`:

| Step | Action |
|------|--------|
| 1 | `MessageService.getMessages(conversationId, userId, { limit: 50 })` |
| 2 | Build Q&A blocks; for assistant messages, skip if `content.length < 80` and `refusalPattern.test(content)` (refusalPattern ≈ REFUSAL_PATTERN) |
| 3 | If `qaText` too short → return "Not enough on-topic Q&A in this conversation to generate a summary." |
| 4 | LLM: "Create a short **Research Session Summary** for the topic \"{topicName}\" based on the following Q&A... Format as markdown, 2–4 sections, concise." |
| 5 | Return markdown summary |

---

## 8. In-Thread "Topic Changed" Message (10.2)

**In `ChatInterface`, `useEffect` on `selectedTopic`:**

| `prevTopicIdRef` | `selectedTopic?.id` | Action |
|------------------|---------------------|--------|
| `undefined` | any | `prevTopicIdRef.current = nextId`; return (initialisation) |
| same as `nextId` | — | return |
| non-null | `null` | Append assistant: "Research mode has been disabled. You can ask about any topic." |
| non-null | non-null (different) | Append assistant: "Research topic is now: **{selectedTopic.name}**. I'll focus on that from here." |
| — | — | `prevTopicIdRef.current = nextId` |

Messages are client-only (not persisted).

---

## 9. Conversation List Topic Badge (9.1)

**In `ConversationItem`:**

If `conversation.topic_id` → render "Research" pill next to the title.

---

## 10. Loading a Conversation with `topic_id`

**In `ChatInterface`, `useEffect` on `currentConversationId`:**

| Step | Action |
|------|--------|
| 1 | `conversationApi.getMessages`, `conversationApi.get` |
| 2 | If `conversation.topic_id`: `topicApi.get(topic_id)` → `setSelectedTopic(loadedTopic)` |
| 3 | `setUnifiedFilters({ topicId: loadedTopic?.id, topic: loadedTopic, keyword, timeRange, ... })` |
| 4 | `mapApiMessagesToUi` (including `metadata.isRefusal` → `isRefusal`) |

Banner and "Exit" work because `selectedTopic` is hydrated from the loaded conversation.

---

## 11. Source-Fetch Request Parity (1.2)

After streaming completes, `aiApi.ask` is used to fetch sources. The request uses the **same** filters as the main `askStream`: `topicId`, `topic`, `timeRange`, `startDate`, `endDate`, `country`, and RAG options (`enableDocumentSearch`, `enableWebSearch`, `documentIds`, `maxDocumentChunks`, `minScore`, `maxSearchResults`).

---

## 12. Sidebar: Clear / Exit from Filters (4.2)

**`SidebarTopicFilters.handleClear`:** `setSelectedTopic(null)`, `setUnifiedFilters` with `topicId: null`, `topic: null`, etc.

**X on selected topic:** `handleTopicSelect(null)` → same effect as clearing; if `currentConversationId`, `conversationApi.update(conversationId, { topicId: undefined })`.

---

## 13. Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ SidebarTopicFilters  ──handleTopicSelect──►  useFilterStore (selectedTopic,   │
│ conversationApi.update(topicId)               unifiedFilters)                │
│                                                                              │
│ ChatInterface                                                                 │
│   handleSend  ──QuestionRequest(topicId, filters, RAG)──► aiApi.askStream     │
│   handleExitResearchMode ──► ResearchSessionSummaryModal or setSelectedTopic  │
│   useEffect(selectedTopic) ──► in-thread "topic changed" (10.2)               │
│   mapApiMessagesToUi  ◄── metadata.isRefusal, followUpQuestions              │
│                                                                              │
│ ResearchModeBanner(onExit)  ◄── selectedTopic from store                      │
│ ChatMessage  ◄── selectedTopicName, onExitResearchMode, message.isRefusal    │
│ ConversationItem  ◄── conversation.topic_id → "Research" badge               │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (ai.routes, ai.service)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ /ask, /ask/stream: destructure topicId, timeRange, startDate, endDate,        │
│   country, RAG options → QuestionRequest                                     │
│                                                                              │
│ /ask/stream:                                                                 │
│   if topicId → getTopic → preCheck? → off-topic? → SSE refusal +             │
│     saveMessagePair(., ., refusal, [], { followUpQuestions, isRefusal })     │
│     [no RAG, no main model]                                                  │
│   else → RAG.retrieveContext → answerQuestionStream → SSE chunks +           │
│     { followUpQuestions } → saveMessagePair                                   │
│                                                                              │
│ /ask (non-stream): same pre-check in AIService.answerQuestion; on-topic       │
│   → RAG → buildMessages(topicName, topicDescription, topicScopeConfig)       │
│   → OpenAI → parse FOLLOW_UP_QUESTIONS → saveMessagePair                     │
│                                                                              │
│ buildSystemPrompt: if topicName, strict/soft from scope_config.strict;        │
│   deriveScopeFromConfig(keywords, subtopics)                                  │
│                                                                              │
│ /research-session-summary: generateResearchSessionSummary(conversationId,    │
│   userId, topicName) → messages → filter refusals → LLM summary → JSON         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Scope Config Schema (stored per topic)

`scope_config` (JSONB) can include:

| Key | Type | Purpose |
|-----|------|---------|
| `suggested_starters` | `string[]` | On-topic starter questions (6.1) |
| `strict` | `boolean` | `true` = refuse off-topic (default); `false` = soft, prioritise only (12.1) |
| `enable_off_topic_pre_check` | `boolean` | `false` = disable pre-check for this topic (8.2) |
| `keywords` | `string[]` | Injected into scope in prompt (5.1) |
| `subtopics` | `string[]` | Injected into scope in prompt (5.1) |

---

*End of workflow summary.*
