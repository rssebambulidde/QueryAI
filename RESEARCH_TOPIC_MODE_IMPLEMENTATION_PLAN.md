# Research Topic Mode – Full Implementation Plan

This document is the implementation plan for Research Topic Mode and all suggested enhancements. It is written for developers; no code is produced here.

---

## Table of Contents

1. [Prerequisites & Bug Fixes](#1-prerequisites--bug-fixes)
2. [Core: Strict Research Topic Mode](#2-core-strict-research-topic-mode)
3. [Response Formatting Parity](#3-response-formatting-parity)
4. [Frontend: Research Mode UX](#4-frontend-research-mode-ux)
5. [Enhancement: Topic Description & Scope in Prompt](#5-enhancement-topic-description--scope-in-prompt)
6. [Enhancement: On-Topic Suggested Starters](#6-enhancement-on-topic-suggested-starters)
7. [Enhancement: Research Session Summary](#7-enhancement-research-session-summary)
8. [Enhancement: Off-Topic Pre-Check](#8-enhancement-off-topic-pre-check)
9. [Enhancement: Visual Indicators](#9-enhancement-visual-indicators)
10. [Enhancement: Switching Topic Mid-Conversation](#10-enhancement-switching-topic-mid-conversation)
11. [Enhancement: Off-Topic Refusal UX](#11-enhancement-off-topic-refusal-ux)
12. [Enhancement: Persist "Strict" Preference per Topic](#12-enhancement-persist-strict-preference-per-topic)
13. [Enhancement: RAG Behavior for Off-Topic (with Pre-Check)](#13-enhancement-rag-behavior-for-off-topic-with-pre-check)
14. [Edge Cases & Validation Rules](#14-edge-cases--validation-rules)
15. [Phasing & Dependencies](#15-phasing--dependencies)

---

## 1. Prerequisites & Bug Fixes

### 1.1 Backend: Forward Search Filters in AI Routes

**File:** `backend/src/routes/ai.routes.ts`  
**Endpoints:** `POST /api/ai/ask`, `POST /api/ai/ask/stream`

**Current:** `timeRange`, `startDate`, `endDate`, `country` are sent by the frontend but not read from `req.body` or set on `QuestionRequest`.

**Tasks:**
1. In the destructuring of `req.body` for both `/ask` and `/ask/stream`, add:  
   `timeRange`, `startDate`, `endDate`, `country`.
2. When building the `QuestionRequest` object passed to `AIService.answerQuestion` / `AIService.answerQuestionStream`, set:  
   `timeRange`, `startDate`, `endDate`, `country` from the destructured values (or `undefined` if absent).
3. Verify that `AIService` and `RAGService` already consume these (they do); no change there.

**Acceptance:** A request body with `timeRange`, `startDate`, `endDate`, `country` results in those values being used in RAG (web search) and in the AI system prompt `timeFilter`.

---

### 1.2 Frontend: Source-Fetch Request Parity

**File:** `frontend/components/chat/chat-interface.tsx`

**Current:** The post-stream `aiApi.ask` call used to fetch sources does not pass `topicId` and uses a reduced set of fields.

**Tasks:**
1. In the `aiApi.ask` call that runs after streaming completes (to attach sources), pass the same filter set as the main streaming request:  
   `topicId`, `topic` (from `activeFilters`), `timeRange`, `startDate`, `endDate`, `country`, and all RAG options (`enableDocumentSearch`, `enableWebSearch`, `documentIds`, `maxDocumentChunks`, `minScore`, `maxSearchResults`).
2. Reuse the same `activeFilters` / `ragSettings` used for the main `askStream` request so behaviour is identical.

**Acceptance:** Sources returned after streaming match the same topic and filters as the streamed answer.

---

## 2. Core: Strict Research Topic Mode

### 2.1 Backend: Strict-Topic System Prompt Block

**File:** `backend/src/services/ai.service.ts`  
**Function:** `buildSystemPrompt` (and any helper that injects “mode” or “scope” instructions).

**Tasks:**
1. **When to apply:**  
   - If `request.topicId` is present, fetch `topicName` (and optionally `topicDescription`, `scope_config`) via `TopicService.getTopic(request.topicId, userId)`.
2. **New instruction block (insert before or after the existing `topicScopeInstruction`):**
   - Title: e.g. `STRICT_RESEARCH_TOPIC_MODE`.
   - Content (conceptual):
     - “You are in **Research Topic Mode**. Your research topic is: **{topicName}**.”
     - “If `topicDescription` or scope is available:”  
       “Scope: {description or derived scope from scope_config}. Only questions clearly within this scope may be answered.”
     - “You MUST only answer questions that are clearly within this topic/scope. If the user’s question is outside this topic, you must respond with a short, polite refusal. Do not provide a substantive answer. Example: ‘I’m currently focused only on [topic]. I can’t answer questions outside this research scope. You can ask about [topic] or disable research mode to ask anything.’”
     - “Do not use document excerpts or web search results to answer off-topic questions.”
     - “For on-topic questions: answer as usual using the provided sources, with inline citations and the required FOLLOW_UP_QUESTIONS block. Use reasonable judgment: if a question is closely or tangentially related (e.g. tools, concepts, or roles in the field), you may answer briefly and relate it to the topic; if clearly unrelated, refuse.”
3. **Integration:**  
   - Ensure this block is appended (or merged) into the system prompt when `topicId` is set. If we later add a “soft” mode, gate this block with a `strictTopicMode` or `scope_config.strict` flag.

**Acceptance:** With `topicId` set, an off-topic question yields a refusal; an on-topic question yields a full, cited answer.

---

### 2.2 Backend: Follow-Up and Action Rules in Topic Mode

**File:** `backend/src/services/ai.service.ts` (same `buildSystemPrompt` or the FOLLOW_UP_QUESTIONS section).

**Tasks:**
1. In the existing “FOLLOW_UP_QUESTIONS” instructions, add a conditional clause:
   - “When in Research Topic Mode (a topic is set): all 4 follow-up questions must be clearly within the topic and help the user explore it further. Do not suggest questions outside the topic.”
2. No change to the output format (still 4 questions, same structure). Action buttons (Summarize, Essay, Report) operate on the message content; no backend format change. Ensure we do not add any instruction that would alter the response structure (paragraphs, citations, FOLLOW_UP_QUESTIONS block).

**Acceptance:** In topic mode, follow-up questions are on-topic; format is unchanged.

---

### 2.3 Backend: Refusal and FOLLOW_UP_QUESTIONS

**File:** `backend/src/services/ai.service.ts` (strict-instruction block).

**Tasks:**
1. In the strict-instruction block, add:
   - “For off-topic refusals: do not include a FOLLOW_UP_QUESTIONS block, or include only a single meta follow-up such as: ‘Would you like to ask something about [topic]?’”
2. Frontend already handles missing or short `followUpQuestions`; no frontend change required for this.

**Acceptance:** Refusal responses do not contain four substantive follow-ups; at most one meta follow-up.

---

## 3. Response Formatting Parity

### 3.1 Frontend: Do Not Hide Actions or Follow-Ups in Topic Mode

**File:** `frontend/components/chat/chat-message.tsx`

**Current:** Action buttons and follow-up questions are shown based on `!isUser`, `onActionResponse`, `!message.isActionResponse`, `!isStreaming`, `!message.isStreaming`, and `message.followUpQuestions?.length` (for follow-ups). There should be no condition that hides these when `selectedTopic != null`.

**Tasks:**
1. Audit `ChatMessage`: ensure no `selectedTopic` or `topicId` check is used to hide:
   - Action buttons (Summarize, Essay, Report),
   - Follow-up questions section.
2. If any such condition exists, remove it. In topic mode, the model still returns `followUpQuestions` for on-topic answers and may return a short/meta follow-up for refusals; the UI should render them the same as in default mode.

**Acceptance:** With a topic selected, action buttons and follow-up questions appear for assistant messages when the model provides them, same as in no-topic mode.

---

### 3.2 Backend: No Format Change in Topic Mode

**File:** `backend/src/services/ai.service.ts`

**Tasks:**
1. Confirm that the “RESPONSE FORMATTING” and “FOLLOW_UP_QUESTIONS” rules in `buildSystemPrompt` are unchanged when `topicId` is set. The only additions are:
   - The strict-topic block (refuse off-topic, constrain follow-up content),
   - The extra follow-up rule in topic mode (on-topic only).
2. Do not introduce different paragraph structure, citation rules, or action-specific formatting when in topic mode.

**Acceptance:** Response shape (paragraphs, citations, FOLLOW_UP_QUESTIONS, and thus actionability) is the same in topic and no-topic mode.

---

## 4. Frontend: Research Mode UX

### 4.1 Research Mode Banner / Indicator

**Files:**  
- `frontend/components/chat/chat-interface.tsx` (or a new `ResearchModeBanner.tsx`),  
- `frontend/lib/store/filter-store.ts` (source of `selectedTopic`).

**Tasks:**
1. When `selectedTopic != null` (from `useFilterStore`), render a clear **“Research mode: {topic.name}”** banner or bar above the message list or above the composer (design choice: above composer is more visible for “current scope”).
2. Optionally show `topic.description` in a tooltip or expandable section. If `scope_config` is available and we surface it later, it can be shown here too.
3. Style: distinct but not overwhelming (e.g. subtle background, icon, and topic name). Ensure it’s visible in default and, if applicable, in dark/light themes.

**Acceptance:** User can see at a glance that research mode is on and which topic is active.

---

### 4.2 Exit Research Mode / Disable Topic

**Files:**  
- `frontend/components/sidebar/sidebar-topic-filters.tsx` (existing “Clear” or similar),  
- `frontend/components/chat/chat-interface.tsx` or the new Research Mode banner.

**Tasks:**
1. **In the Research Mode banner:**  
   - Add an “Exit research mode” or “Disable topic” control (button or link). On click: call `setSelectedTopic(null)` and `setUnifiedFilters(prev => ({ ...prev, topicId: null, topic: null }))` (or use `setSelectedTopic(null)` if the store already clears `topicId`/`topic` in that case). Clear `keyword` only if product logic requires it; otherwise it can remain.
2. **In the sidebar (Topic & filters):**  
   - Ensure “Clear filters” / “Clear topic” (or equivalent) also performs the same clear so that research mode is exited from there too. Reuse the same store actions.
3. **Conversation `topic_id`:**  
   - Decouple “exit research mode” from “clear conversation’s topic_id”. Exiting only clears the current `selectedTopic` in the filter store so the next request has no topic. The conversation’s `topic_id` can remain for metadata/organisation. If product wants “exit” to also clear `conversation.topic_id`, add an `conversationApi.update(conversationId, { topicId: null })` when the current conversation is loaded and user exits. Plan: default to “exit affects only filters”; document the alternative.

**Acceptance:** One click on “Exit research mode” or “Clear topic” disables the topic; the next sent message is unscoped and the AI can answer any query.

---

### 4.3 Topic Selector as “Enter Research Mode”

**File:** `frontend/components/sidebar/sidebar-topic-filters.tsx`

**Tasks:**
1. When the user selects a topic from the dropdown (and when creating and selecting a new topic), treat it as “entering research mode”. No extra API call; the existing `handleTopicSelect` and store updates are sufficient.
2. Ensure that when a topic is selected, the Research Mode banner (in the chat view) appears. The sidebar may also show a small “Research mode on” or badge next to the topic name for consistency.

**Acceptance:** Selecting a topic in the sidebar immediately puts the user in research mode; the banner reflects it.

---

## 5. Enhancement: Topic Description & Scope in Prompt

### 5.1 Backend: Pass Topic Description and scope_config to the Prompt

**Files:**  
- `backend/src/services/ai.service.ts`,  
- `backend/src/services/topic.service.ts` (or wherever topic is fetched).

**Tasks:**
1. When `request.topicId` is present, in `answerQuestion` and `answerQuestionStream`, fetch the full topic (or at least `name`, `description`, `scope_config`) via `TopicService.getTopic(request.topicId, userId)`.
2. In `buildSystemPrompt`, when building the strict-topic block:
   - Use `topic.name` as `topicName`.
   - If `topic.description` exists, append: “Description/scope: {description}.”
   - If `topic.scope_config` exists and has a usable structure (e.g. `{ "keywords": ["..."], "subtopics": ["..."] }`), derive a short scope line, e.g. “Scope includes: …” and inject it. Define a simple schema for `scope_config` and document it.
3. This block is already part of the strict-instruction in section 2.1; here we only expand the “scope” part.

**Acceptance:** The model receives not only the topic name but also its description and, when available, scope_config-derived scope, leading to more consistent in/out-of-scope decisions.

---

## 6. Enhancement: On-Topic Suggested Starters

### 6.1 Data: Suggested Questions per Topic

**Options:**
- **(A)** Store on the topic: e.g. `scope_config.suggested_starters: string[]` (e.g. 2–4 questions).
- **(B)** Generate from `topic.description` or `scope_config` via a one-time or on-demand job and cache on the topic or in memory.
- **(C)** Use a fixed template per “topic type” if we introduce types later.

**Recommendation for plan:** Start with **(A)**: optional `scope_config.suggested_starters`. If not set, we can leave the UI empty or add a generic set (e.g. “What is [topic]?”, “Key concepts in [topic]?”) in the frontend.

**Tasks:**
1. **Backend – Topic model and API:**
   - Ensure `scope_config` (JSONB or equivalent) can store `suggested_starters: string[]`. Document the schema. If the topic create/update API already accepts `scope_config`, document that `suggested_starters` is an optional key.
2. **Frontend – Topic manager (create/edit topic):**
   - In the topic form, add an optional “Suggested starter questions” (multi-line or repeatable inputs). On save, write them into `scope_config.suggested_starters`.
3. **Frontend – When entering research mode:**
   - If `selectedTopic` has `scope_config?.suggested_starters` and it’s a non-empty array, show 2–4 of them as clickable chips or buttons near the composer (e.g. “Try: …”). On click, insert the question into the composer and optionally trigger send (or let the user edit first). If `suggested_starters` is absent or empty, either show nothing or show 1–2 generic questions based on `topic.name` (e.g. “What are the key concepts in {name}?”, “How does {name} work in practice?”).

**Acceptance:** For topics with `suggested_starters`, user sees on-topic starter questions when entering research mode; clicking one inserts (and optionally sends) the question.

---

## 7. Enhancement: Research Session Summary

### 7.1 When to Offer

- When the user **exits research mode** (clicks “Exit research mode” or clears the topic) while in a conversation that has on-topic Q&A in the current thread.

**Tasks:**
1. **Frontend – Exit research mode flow:**
   - When the user clicks “Exit research mode” (or equivalent), before or after clearing the topic, check: (a) there is a `currentConversationId`, (b) the current `messages` (or the last N messages) contain at least one assistant answer that is not a refusal (heuristic: has substantive content and/or `followUpQuestions`). If both are true, show a modal or toast: “Summarise this research session?” (or “Create a research report?”) with [Yes] [No].
2. **If Yes:**
   - Call a new backend endpoint, e.g. `POST /api/ai/research-session-summary`, with:
     - `conversationId`,
     - `topicId` or `topicName` (the topic that was active; we can send it before clearing, or store “last exited topic” temporarily),
     - optionally `messageIds` or “last N messages” to limit scope.
   - Backend: load the indicated messages, filter to on-topic Q&As (optional: exclude refusals by simple heuristic), and run a prompt that produces a short “Research session summary” or “Report” for that topic. Reuse or adapt the existing “report” logic if possible. Return markdown or plain text.
   - Frontend: show the result in a modal or a new assistant message; offer “Copy” and “Close”. Optionally “Save as document” or “Add to conversation” as a later enhancement.
3. **If No:**
   - Proceed with exit only; no API call.

**Acceptance:** When exiting research mode after at least one on-topic Q&A, user can optionally get a research session summary; the summary is based on the conversation and the topic.

---

## 8. Enhancement: Off-Topic Pre-Check

### 8.1 Purpose

- Before running full RAG + main model, classify the question as on-topic or off-topic. If off-topic, skip RAG and main model and return a fixed or templated refusal. Reduces cost and keeps refusals consistent.

### 8.2 Backend: Pre-Check Step

**File:** `backend/src/services/ai.service.ts` (or a new `OffTopicClassifier` / helper used by AIService).

**Tasks:**
1. **When to run:**  
   - Only when `request.topicId` is set and we have a `topicName` (and optionally `topicDescription` or scope). If `topicId` is absent, skip.
2. **Implementation options:**
   - **(A) Lightweight LLM call:**  
     - Prompt: “Topic: {topicName}. Scope: {description or ‘general’}. Question: {request.question}. Is this question clearly within the topic? Answer only: YES or NO.”  
     - Use a cheap/small model or a single completion with low max_tokens. If answer (normalised) is NO, treat as off-topic.
   - **(B) Embedding similarity:**  
     - Embed `topicName` + `description` and `request.question`, compute similarity. If below a threshold, treat as off-topic. Requires thresholds and may be less accurate for edge cases.
   - **(C) Keyword/heuristic:**  
     - Only for obvious cases (e.g. topic “Data engineering”, question “Recipe for pasta”). Low implementability for nuanced boundaries.

**Recommendation:** **(A)** for accuracy and simplicity. **(B)** can be an optional, faster path for very low latency.

3. **Integration in `answerQuestion` and `answerQuestionStream`:**
   - After validating `request.question` and before calling `RAGService.retrieveContext`:
     - If pre-check is enabled and result is off-topic:
       - Do not call `RAGService.retrieveContext` (and thus no Tavily, no Pinecone).
       - Compose a refusal message (e.g. from a template or a very short LLM call). For streaming, send the refusal as one or a few chunks, then a `{ done: true }` (and no `followUpQuestions`, or a single meta follow-up). For non-streaming, return `{ answer: refusalText, sources: [], followUpQuestions: [] }` or similar.
     - If on-topic or pre-check is disabled, proceed as today (RAG + full model).
4. **Feature flag or config:**
   - Add a feature flag, e.g. `ENABLE_OFF_TOPIC_PRE_CHECK` or `scope_config.enable_off_topic_pre_check` per topic, so we can turn it off if it causes false negatives.

**Acceptance:** For an off-topic question in topic mode with pre-check on, RAG and main model are not called; a consistent refusal is returned. For on-topic, flow is unchanged.

---

### 8.3 Refusal Template

**File:** Backend (e.g. `ai.service` or a small `refusal.template.ts`).

**Tasks:**
1. Define a refusal template with placeholders, e.g.  
   “I’m currently in Research Topic Mode and limited to **{topicName}**. Your question seems outside this scope. You can ask about {topicName} or disable research mode to ask anything.”
2. Use it for: (a) pre-check refusals, (b) optionally for main-model refusals if we want to normalise wording (alternative: let the model generate refusals per the strict prompt).
3. Ensure `topicName` is injected; if we have a “disable research mode” wording, keep it generic so it stays correct when the UX changes.

**Acceptance:** Pre-check refusals use a consistent, understandable template.

---

## 9. Enhancement: Visual Indicators

### 9.1 Conversation List: Topic Badge

**Files:**  
- `frontend/components/chat/conversation-item.tsx` (or equivalent in the sidebar conversation list),  
- `frontend/lib/api.ts` or types: `Conversation` may include `topic_id` or a `topic` object.

**Tasks:**
1. When rendering a conversation in the list, if `conversation.topic_id` (or `conversation.topic`) is present, show a small badge or icon next to the title, e.g. “Research” or the topic name. Use a distinct style (e.g. colour, icon) so research conversations are quickly recognisable.
2. If the list is sorted or grouped, optional: add a “Research” or “By topic” grouping later; not required for v1.

**Acceptance:** Conversations that have a topic show a visual indicator in the list.

---

### 9.2 Chat Header / Research Mode Bar

**Files:**  
- `frontend/components/chat/chat-interface.tsx` or a header component,  
- The Research Mode banner component from 4.1.

**Tasks:**
1. In the chat area, when a topic is selected, ensure the Research Mode banner is visible and includes:
   - “Research: {topic.name}” (or “Research mode: {topic.name}”),
   - “Exit research mode” control.
2. If the app has a dedicated “chat header” (e.g. conversation title + actions), we can instead or additionally show “Research: {topic.name}” there. Prefer one canonical place (the banner) to avoid duplication.
3. Ensure the same component works when the conversation is loaded with a `topic_id` and the store is initialised from it (so the banner appears even when the user didn’t pick the topic in this session).

**Acceptance:** User always sees that research mode is on and which topic is active, and can exit from the same area.

---

## 10. Enhancement: Switching Topic Mid-Conversation

### 10.1 Behaviour

- User changes the selected topic in the sidebar (or in a topic selector in the chat area) while the same conversation is open. The next user message uses the new topic. The model’s strict instruction and RAG use the new topic.

### 10.2 Optional: In-Thread “Topic Changed” Message

**Files:**  
- `frontend/components/chat/chat-interface.tsx`,  
- `frontend/lib/store/filter-store.ts`.

**Tasks:**
1. **Detect topic change:**  
   - In the chat interface, when `selectedTopic` changes (e.g. via `useEffect` on `selectedTopic` or a store subscription) and the change is from one non-null topic to another (or from null to non-null, or non-null to null), we have a “topic change” event. For “null → null” or identical topic id, ignore.
2. **Insert an in-thread message (optional):**
   - Push a synthetic assistant (or system) message into `messages`, e.g.  
     “Research topic is now: **{newTopic.name}**. I’ll focus on that from here.”  
   - For “topic → null”:  
     “Research mode has been disabled. You can ask about any topic.”  
   - Do not persist this to the backend as a normal message unless we define a `system` or `meta` message type and the backend supports it. For v1, keeping it client-only is simpler; it will not appear after a reload. If we want it persisted, add a `role: 'system'` or `metadata: { type: 'topic_change' }` and ensure the backend and `conversationApi` support it.
3. **Conversation `topic_id`:**  
   - When the user selects a new topic, we can call `conversationApi.update(conversationId, { topicId: newTopic.id })` so the conversation’s topic reflects the latest. When the user sets topic to null (exit research mode), we can either update `topic_id` to null or leave it for history; align with 4.2.

**Acceptance:** When the user switches topic mid-conversation, the next answer uses the new topic; optionally an in-thread message states the change.

---

## 11. Enhancement: Off-Topic Refusal UX

### 11.1 Detecting a Refusal

**Options:**
- **(A) Pattern match:**  
  - In the frontend, after receiving the assistant message, check for phrases like “I can only answer”, “outside (my|this) topic”, “research (mode|topic)”, “limited to”, “disable research mode”. If there’s a match, set `message.metadata.isRefusal = true` or a local state for “last message is refusal”.
- **(B) Backend flag:**  
  - In the backend, when the model refuses (or when the pre-check triggers), add a field to the response, e.g. `refusal: true` or `metadata: { refusal: true }`. For streaming, we’d need a way to send this (e.g. a `{ refusal: true }` object in the stream or in the `{ done: true }` payload). For non-streaming, it’s straightforward.
- **(C) No detection:**  
  - Rely on the model’s natural refusal; no extra UX.

**Recommendation:** **(B)** for pre-check refusals (we know when we’re refusing). For main-model refusals, **(A)** is simpler to add first; we can later move to **(B)** if we add a structured refusal signal from the model.

### 11.2 Frontend: Refusal Hint

**File:** `frontend/components/chat/chat-message.tsx` or a wrapper.

**Tasks:**
1. When the message is considered a refusal (by pattern or by `metadata.refusal`):
   - Below the refusal, show a short hint:  
     “This question seems outside **{topicName}**. Ask something about [topic] or exit research mode to ask anything.”
   - `topicName` comes from `selectedTopic.name` in the store. The second part can be a link/button that either (a) focuses the composer, (b) triggers “Exit research mode”, or (c) both.
2. Ensure the hint is only shown when we’re in research mode (`selectedTopic != null`) and the message is a refusal. Do not show for non-refusal messages.

**Acceptance:** After a refusal, the user sees a clear hint and a quick way to exit research mode or stay on topic.

---

## 12. Enhancement: Persist “Strict” Preference per Topic

### 12.1 Data Model

- **Topic:** `scope_config` (or a top-level field if we prefer) holds a flag, e.g. `strict: boolean` or `research_mode_only: boolean`.  
- When `strict` is true: always use the strict instruction (refuse off-topic) when this topic is selected.  
- When `strict` is false or missing: “soft” topic behaviour (prioritise topic, add scope to prompt, but do not refuse off-topic). Default: `true` for backward compatibility with “research mode” semantics, or `false` if we want to keep current behaviour for existing topics.

**Tasks:**
1. **Backend – Topic schema and API:**
   - Document `scope_config.strict` (or equivalent). In topic create/update, accept it. In `TopicService.getTopic`, return it.
2. **AIService:**
   - When building the strict-topic block, check `topic.scope_config?.strict !== false` (or `topic.research_mode_only === true` if we use a separate field). If false, do not add the “refuse off-topic” part; only add the “scope/prioritise” part (current `topicScopeInstruction`). If true or unset, add the full strict block.
3. **Frontend – Topic manager:**
   - In the topic create/edit form, add a checkbox: “Research mode only (refuse off-topic questions)”. Map to `scope_config.strict`. Default: checked (or per product decision).
4. **Filter store / selection:**
   - No change: `selectedTopic` is enough; the backend decides strict vs soft from the topic entity.

**Acceptance:** Per-topic, user can choose “strict” (refuse off-topic) or “soft” (prioritise but allow off-topic). Backend applies the correct prompt.

---

## 13. Enhancement: RAG Behavior for Off-Topic (with Pre-Check)

### 13.1 When Pre-Check Says Off-Topic

**File:** `backend/src/services/ai.service.ts` (integration of pre-check, see 8.2).

**Tasks:**
1. When the off-topic pre-check returns “off-topic”:
   - Do **not** call `RAGService.retrieveContext`. That implies: no `PineconeService.search`, no `SearchService.search` (Tavily).
2. Return the refusal (template or short LLM-generated) as in 8.2 and 8.3. No `sources`, or `sources: []`. No RAG cost, no risk of feeding off-topic snippets into the model.

**Acceptance:** Pre-check off-topic path triggers no document or web search.

---

### 13.2 When Pre-Check Says On-Topic or Pre-Check Is Off

- RAG and main model run as today. No change.

---

## 14. Edge Cases & Validation Rules

### 14.1 Boundary Questions

- **Rule (in prompt):** The model uses reasonable judgment; tangentially related questions can get a brief, steered answer; clearly unrelated get a refusal. Rely on the strict-instruction and scope description; no extra backend logic.

### 14.2 Topic With No or Few Sources

- **Rule:** If RAG returns few or no doc chunks and few or no web results, the model can:
  - Answer from general knowledge only if the product allows, or
  - State that there isn’t enough in the provided sources and suggest uploading documents or broadening search.
- No change to RAG logic; the existing “use provided sources” and “if not enough, say so” in the prompt are sufficient for v1.

### 14.3 Topic Change Mid-Conversation

- New topic applies from the next user message. Old messages remain in `conversationHistory`; the model may ignore off-topic content per the new strict instruction. Optional in-thread “topic changed” message is in 10.2.

### 14.4 Refusals and FOLLOW_UP_QUESTIONS / Actions

- For refusals: no FOLLOW_UP_QUESTIONS or only a meta follow-up (2.3). Frontend may hide action buttons for refusals later (11.2); not required for v1.

### 14.5 Pre-Check False Negatives

- If the pre-check incorrectly labels an on-topic question as off-topic, we always refuse. Mitigations:
  - Tune the pre-check prompt or model.
  - Feature flag to disable pre-check.
  - Per-topic `scope_config.enable_off_topic_pre_check: false`.

### 14.6 Loading a Conversation With topic_id

- When we load a conversation that has `topic_id`, we already load topic and set `selectedTopic` and `topicId` in the filter store. Ensure the Research Mode banner and “Exit” appear. No extra logic beyond correct hydration of the store from `conversation.topic_id` and `metadata.filters`.

---

## 15. Phasing & Dependencies

### Phase 1 – Prerequisites and Core (Must Have)

| Order | Item | Depends on |
|-------|------|------------|
| 1.1 | Backend: forward `timeRange`, `startDate`, `endDate`, `country` in AI routes | — |
| 1.2 | Frontend: source-fetch request parity (`topicId` + filters) | — |
| 2.1 | Backend: strict-topic system prompt block | 1.1 |
| 2.2 | Backend: follow-up and refusal rules in topic mode | 2.1 |
| 2.3 | Backend: refusal and FOLLOW_UP_QUESTIONS | 2.1 |
| 3.1 | Frontend: do not hide actions/follow-ups in topic mode | — |
| 3.2 | Backend: no format change in topic mode | 2.1 |
| 4.1 | Frontend: Research mode banner | — |
| 4.2 | Frontend: Exit research mode / disable topic | 4.1 |
| 4.3 | Frontend: topic selector as “enter research mode” | 4.1 |

**Deliverable:** Research topic mode with strict scoping, refusal for off-topic, same response format as default, and clear UX to enter/exit.

---

### Phase 2 – Prompt and RAG Refinements

| Order | Item | Depends on |
|-------|------|------------|
| 5.1 | Backend: topic description and `scope_config` in prompt | 2.1 |
| 8.1–8.3 | Off-topic pre-check + refusal template | 2.1 |
| 13.1 | RAG skip when pre-check says off-topic | 8.x |

**Deliverable:** Richer scope for the model, consistent refusals, and no RAG for clear off-topic.

---

### Phase 3 – UX and Extra Features

| Order | Item | Depends on |
|-------|------|------------|
| 6.1 | On-topic suggested starters | 4.1, 5.1 (optional) |
| 9.1 | Conversation list: topic badge | — |
| 9.2 | Chat header / research bar | 4.1 |
| 10.2 | Switching topic: optional in-thread message | 4.1 |
| 11.1–11.2 | Refusal detection and hint | 2.1, 4.1 |
| 12.1 | Persist “strict” per topic | 2.1, topic API |

**Deliverable:** Suggested starters, stronger visual indicators, topic-change message, refusal hint, and per-topic strict/soft.

---

### Phase 4 – Research Session and Polish

| Order | Item | Depends on |
|-------|------|------------|
| 7.1 | Research session summary on exit | 4.2, new `/api/ai/research-session-summary` |

**Deliverable:** Option to generate a research session summary when exiting research mode.

---

## 16. Files to Create or Touch (Summary)

**Backend**

- `backend/src/routes/ai.routes.ts` – 1.1  
- `backend/src/services/ai.service.ts` – 2.1, 2.2, 2.3, 3.2, 5.1, 8.1–8.3, 13.1, 12.1  
- `backend/src/services/topic.service.ts` – 5.1, 12.1 (if needed)  
- New: `backend/src/routes/ai.routes.ts` or equivalent – 7.1 (`/research-session-summary`)  
- New: optional `backend/src/services/refusal.ts` or similar – 8.3  
- Topic schema / migrations – 12.1 (if new columns or `scope_config` shape)

**Frontend**

- `frontend/components/chat/chat-interface.tsx` – 1.2, 4.1, 4.2, 7.1, 10.2  
- `frontend/components/chat/chat-message.tsx` – 3.1, 11.2  
- `frontend/components/sidebar/sidebar-topic-filters.tsx` – 4.2, 4.3, 6.1 (if starters are edited here)  
- `frontend/components/chat/conversation-item.tsx` (or equiv.) – 9.1  
- `frontend/lib/store/filter-store.ts` – 4.2 (if any new state; likely not)  
- New: `frontend/components/chat/ResearchModeBanner.tsx` – 4.1, 9.2  
- New: `frontend/components/chat/ResearchSessionSummaryModal.tsx` – 7.1 (optional)  
- Topic create/edit form (e.g. in TopicManager or a dedicated form) – 6.1, 12.1  

**Shared / Config**

- Topic `scope_config` schema and API docs – 5.1, 6.1, 12.1  
- Feature flags or env (e.g. `ENABLE_OFF_TOPIC_PRE_CHECK`) – 8.2  

---

## 17. Testing and Acceptance (High Level)

- **Strict mode:** With topic selected, off-topic → refusal; on-topic → full answer and follow-ups.  
- **Format parity:** Actions and follow-ups in topic mode match default mode.  
- **Exit research mode:** One action clears topic; next request is unscoped.  
- **Pre-check (Phase 2):** Off-topic with pre-check on → no RAG, template refusal.  
- **Suggested starters (Phase 3):** Starters shown and usable when configured.  
- **Research session summary (Phase 4):** On exit, user can request a summary and receive a report.

---

*End of implementation plan.*
