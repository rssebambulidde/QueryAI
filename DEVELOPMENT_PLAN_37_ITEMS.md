# QueryAI — Full Development Plan (37 Items)
> Generated: February 18, 2026  
> Covers: RAG Core · Document/Topic Management · AI Service · Response/Conversation/Formatting

---

## How to Read This Plan

Each item lists:
- **What to do** — concrete implementation steps
- **Files affected** — exact file paths
- **Impact / Benefit** — measurable or qualitative outcome

Priority tiers:
- **P0** — Critical (bugs, cost, correctness blockers — fix first)
- **P1** — High (reliability, data integrity, quality)
- **P2** — Medium (UX, efficiency, maintainability)
- **P3** — Future (research-grade features)

---

---

# P0 — CRITICAL

---

## Item 1 · Extract shared `prepareRequest()` to eliminate 400-line pipeline duplication

### What to do
1. Create a new method `AIAnswerPipelineService.prepareRequestContext(request, userId)` that encapsulates:
   - Topic details fetch (`TopicService.getTopic`)
   - RAG retrieval (`RAGService.retrieveContext` + `RAGService.formatContextForPrompt`)
   - Source extraction (`RAGService.extractSources`)
   - Fallback web search when no userId
   - Conversation history fetch (sliding window → summarization → raw fallback)
   - History relevance filtering (`HistoryFilterService.filterHistory`)
   - Model selection (`selectModel`)
   - Few-shot example selection (`FewShotSelectorService.selectExamples`)
   - Message building (`PromptBuilderService.buildMessages`)
2. Return a typed `PreparedContext` object: `{ ragContext, sources, conversationHistory, selectedModel, modelSelectionReason, messages, topicName, topicDescription, topicScopeConfig, timeFilter, temperature, maxTokens }`
3. Replace the duplicated blocks in `answerQuestionInternal()` (lines ~300–700) and `answerQuestionStreamInternal()` (lines ~1200–1580) with a single `prepareRequestContext()` call
4. Remove the `_preRetrievedRagContext` workaround in `ai.routes.ts` — the route no longer needs to pre-retrieve context since it calls the pipeline's shared method

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/ai.service.ts` (remove `_preRetrievedRagContext` from `QuestionRequest`)

### Impact / Benefit
- Eliminates ~400 lines of duplicated code
- Any future change (new RAG option, new history strategy) needs editing in one place instead of three
- Reduces risk of streaming/non-streaming pipelines diverging in behavior
- Removes the `_preRetrievedRagContext` hack which was a symptom of the duplication

---

## Item 2 · Condense system prompt from ~4000 to ~1000 tokens

### What to do
1. Audit `PromptBuilderService.buildSystemPrompt()` — currently the system prompt contains 6+ repetitions of citation instructions
2. Collapse all citation rules into a single block with one clear example:
   ```
   CITATION RULE: Every factual claim must include an inline markdown link.
   Web sources: [Web Source N](exact-url-from-context)
   Documents: [Document N] or [Document Name](document://id)
   ```
3. Move the paragraph-structure formatting rules into the few-shot examples (show, don't tell)
4. Remove the "VALIDATION CHECK" and "CITATION ENFORCEMENT" sub-sections — these are prompt padding that increases token count without improving compliance
5. Trim `getFollowUpBlock()` from ~200 words to ~30 words: "End every non-refusal response with exactly: `FOLLOW_UP_QUESTIONS:` followed by 4 bullet questions derived from this specific exchange."
6. Keep quality and conflict-resolution guidelines but cap each at 3–4 bullet points, not free-form paragraphs
7. Set a token budget test: after changes, count system-prompt tokens; target < 1000 for the base prompt, < 1800 including RAG context headers
8. Run A/B comparison: 10 test queries against old vs new prompt, compare citation compliance and answer quality

### Files affected
- `backend/src/services/prompt-builder.service.ts`
- `backend/data/citation-guidelines.json` (trim)
- `backend/data/quality-guidelines.json` (trim)
- `backend/data/conflict-resolution-guidelines.json` (trim)

### Impact / Benefit
- Saves approximately $0.003–0.005 per query in prompt token costs (at current GPT-3.5 pricing, this is meaningful at thousands of daily queries)
- Reduces model confusion — dense repeated instructions cause models to partially ignore instructions that appear late in the system prompt
- Faster time-to-first-token (fewer input tokens to process)
- Smaller context window consumption, leaving more room for RAG context and conversation history

---

## Item 3 · Add Zod validation for `QuestionRequest` at route entry

### What to do
1. Install `zod` if not already present: `npm install zod`
2. Create `backend/src/schemas/ai-request.schema.ts`:
   - Define `QuestionRequestSchema` as a Zod object with all fields typed
   - Group into nested objects: `.shape.ragOptions`, `.shape.conversationOptions`, `.shape.citationOptions` for readability
   - Mark all runtime-only/internal fields (e.g., `_preRetrievedRagContext`) as `.optional().strip()` so they are removed on parse
3. Add a `validateRequest` middleware in `backend/src/middleware/validate.ts`
4. Apply to both `POST /api/ai/ask` and `POST /api/ai/ask/stream` routes before authentication (so invalid requests fail-fast before even authenticating)
5. Return structured 400 responses with field-level error messages: `{ errors: [{ field: "question", message: "Required" }] }`
6. Update `QuestionRequest` TypeScript interface to derive from the Zod schema: `type QuestionRequest = z.infer<typeof QuestionRequestSchema>`

### Files affected
- `backend/src/schemas/ai-request.schema.ts` (new)
- `backend/src/middleware/validate.ts` (new or extend)
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/ai.service.ts` (re-derive type from schema)

### Impact / Benefit
- Catches silent option typos (e.g., `enableReranking` misspelled) that currently produce wrong behavior with no error
- Provides automatic API documentation for the request shape
- Reduces defense code inside the pipeline (no more `?? false` for every boolean flag)
- Prevents invalid enum values reaching service code (e.g., `expansionStrategy: 'none'` vs `'hybrid'`)

---

## Item 4 · Unify frontend citation processing into single pass

### What to do
1. Remove the `processContentWithSources()` function in `chat-message.tsx` entirely (~lines 116–204)
2. Remove the call to `processContentWithSources(content, sources)` before passing to `EnhancedContentProcessor`
3. Pass raw `content` directly to `EnhancedContentProcessor` along with the `sources` array
4. Update `EnhancedContentProcessor` to accept a `sources` prop and use it for citation resolution alongside `parsedCitations`
5. Update `parseCitations()` in `frontend/lib/citation-parser.ts` so it receives the sources array and can resolve `[Web Source N]` / `[Document N]` references directly to title+URL without needing a pre-processing pass
6. Add a test: render a message containing `[Web Source 1]`, `[Web Source 2]`, and a `Sources:` line — verify each renders exactly once

### Files affected
- `frontend/components/chat/chat-message.tsx`
- `frontend/components/chat/enhanced-content-processor.tsx`
- `frontend/lib/citation-parser.ts`
- `frontend/lib/utils/markdown-components.tsx` (update `a` component if citation props change)

### Impact / Benefit
- Eliminates double/missed citation rendering (current bug where some citations render as text and others as links)
- Removes ~90 lines of fragile regex code
- Single pass is more performant (one regex scan vs three)
- Predictable citation rendering regardless of citation format variations in LLM output

---

## Item 5 · Include `topicId` in LLM cache key

### What to do
1. In `generateLLMCacheKey()` in `ai-answer-pipeline.service.ts`, add `topicId` as a parameter
2. Hash `topicId ?? 'no-topic'` into the key string alongside question, model, temperature, context, and history hashes
3. Update all callers of `generateLLMCacheKey()` to pass `request.topicId`
4. Write a unit test: same question with two different `topicId` values should produce different cache keys

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`

### Impact / Benefit
- Fixes a cache correctness bug: currently the same question asked in Topic A can return Topic B's cached response
- Critical for research mode where topic-scoped answers differ significantly from general answers
- One line change with high safety impact

---

## Item 6 · Replace cross-encoder reranking stub with real implementation

### What to do
1. Evaluate options: (a) HuggingFace `cross-encoder/ms-marco-MiniLM-L-6-v2` via ONNX Runtime (local, no API cost), (b) Cohere Rerank API (cloud, simple), (c) Jina Reranker API
2. Recommended: integrate **Cohere Rerank v3** via `cohere-ai` npm package — single API call, no model hosting needed
3. In `reranking.service.ts`, replace the stub `scoreBased()` fallback with a real `crossEncoderRerank(query, documents)` method using Cohere's `/v1/rerank` endpoint
4. Add `COHERE_API_KEY` to environment variables and config
5. Add error handling: if Cohere is unavailable, fall back to score-based reranking (current behavior)
6. Add latency tracking via `LatencyTrackerService`
7. Test: send 10 document chunks, verify returned order differs from score-based order and is relevance-ordered

### Files affected
- `backend/src/services/reranking.service.ts`
- `backend/src/config/` (add Cohere config)
- `.env.example`

### Impact / Benefit
- Cross-encoder reranking is the single highest-quality improvement available to RAG recall — it re-scores retrieved chunks with query-document joint attention, significantly reducing irrelevant context passed to the LLM
- Directly improves answer quality and reduces hallucination from low-relevance context
- Currently the `crossEncoderRerank` path silently falls through to score-based, so users choosing "cross-encoder" strategy get no benefit

---

## Item 7 · Refactor 1572-line `documents.routes.ts` into controller + service

### What to do
1. Create `backend/src/controllers/document.controller.ts` — move all route handler bodies here as named functions (`uploadDocuments`, `getDocuments`, `getDocument`, `deleteDocument`, `reprocessDocument`, `searchDocuments`, etc.)
2. Create `backend/src/services/document-processing.service.ts` — move business logic out of route handlers: chunking decisions, queue dispatching, status polling, MIME validation
3. Reduce `documents.routes.ts` to only route definitions + middleware chains (< 100 lines)
4. Group endpoints into logical sections with express Routers: `/documents` base router → `/upload`, `/search`, `/:id`, `/:id/reprocess`, `/:id/chunks`
5. Ensure all moved logic has the same behavior (this is a refactor, not a rewrite)
6. Add JSDoc to all public controller methods

### Files affected
- `backend/src/routes/documents.routes.ts`
- `backend/src/controllers/document.controller.ts` (new)
- `backend/src/services/document-processing.service.ts` (new or extend existing)

### Impact / Benefit
- 1572-line route file is unmaintainable — a developer cannot read the entire file in one sitting
- Controller/service separation makes unit testing possible (test business logic without express)
- Easier to find and modify specific handlers
- Foundation for future document pipeline improvements

---

---

# P1 — HIGH

---

## Item 8 · Use structured outputs / function calling for citations and follow-ups

### What to do
1. Define an OpenAI function/tool schema for the structured response:
   ```json
   {
     "answer": "string",
     "followUpQuestions": ["string", "string", "string", "string"],
     "citedSources": [{ "index": 1, "type": "web|document", "url": "string" }]
   }
   ```
2. Use `response_format: { type: "json_schema", json_schema: ... }` (GPT-4o) or `tools` + `tool_choice: "required"` (GPT-3.5/4)
3. For the streaming path, use `stream: true` with tool calls — accumulate the tool call delta chunks and parse the complete JSON once streaming ends
4. Remove `ResponseProcessorService.extractFollowUpQuestions()` and the regex parsing pipeline
5. Remove `CitationParserService` regex parsing (citations are now explicitly listed in the structured output)
6. Retain `CitationValidatorService` to validate that cited source indices actually correspond to available sources

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/services/prompt-builder.service.ts` (simplify system prompt since format is enforced structurally)
- `backend/src/services/response-processor.service.ts` (remove regex extraction methods)
- `backend/src/services/citation-parser.service.ts` (can be deprecated for primary flow)

### Impact / Benefit
- Eliminates the fragile regex-based citation and follow-up extraction that causes inconsistent rendering
- Guaranteed 4 follow-up questions on every response (no more fallback LLM call to generate them)
- Guaranteed citation format — no more `[Web Source 1]` vs `[Source 1]` vs `[Title](url)` variations
- Saves the follow-up generation fallback API call (~$0.0003 per miss, ~10–20% of responses)

---

## Item 9 · Wire up `conversationStateText` (currently always empty)

### What to do
1. In both `answerQuestionInternal()` and `answerQuestionStreamInternal()`, before calling `buildMessages()`:
   - If `request.conversationId` and `userId` are set and `request.enableStateTracking !== false`:
     - Call `ConversationStateService.getState(conversationId, userId)`
     - If state exists and has topics/entities, call `ConversationStateService.formatStateForContext(state)`
     - Assign result to `conversationStateText`
2. Pass `conversationStateText` to `buildMessages()` (already a parameter, just never populated)
3. Add a prompt section for conversation state that is compact: inject at most 5 topics, 10 entities, 10 concepts (token budget ~200 tokens)
4. Add system prompt instruction near the conversation state section: "Use the following conversation context to understand entity references and maintain consistency"

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/services/prompt-builder.service.ts`
- `backend/src/services/conversation-state.service.ts`

### Impact / Benefit
- Enables pronoun/entity resolution across turns: "Tell me more about it" can now resolve "it" to the entity discussed 8 messages ago
- Reduces repetitive context re-establishment in long research sessions
- The entire `ConversationStateService` currently runs (expensive LLM call every 5 messages) but its output is never used — this wastes money and time for no gain, or the feature should be removed; wiring it up makes the investment pay off

---

## Item 10 · Make `saveMessagePair()` atomic (single transaction)

### What to do
1. Replace the two sequential `saveMessage()` calls with a single Supabase `rpc` call that inserts both messages in one transaction
2. Create a Supabase SQL function `save_message_pair(p_conversation_id, p_user_content, p_assistant_content, p_sources, p_metadata)` that inserts both rows and calls `update_conversation_timestamp()` atomically
3. Deploy the SQL function via a Supabase migration
4. Update `MessageService.saveMessagePair()` to call `supabaseAdmin.rpc('save_message_pair', { ... })`
5. Keep the individual `saveMessage()` method for other callers

### Files affected
- `backend/src/services/message.service.ts`
- `supabase/migrations/` (new migration file for the RPC function)

### Impact / Benefit
- Prevents data loss: currently if the server process crashes between saving user message and assistant message, the conversation has a dangling unanswered user message
- Reduces 2 DB round trips to 1
- Correct behavior in all failure scenarios (both messages save or neither does)

---

## Item 11 · Add DB-level `LIMIT` to `getAllMessages()` before summarization

### What to do
1. In `MessageService.getAllMessages()`, add an optional `limit` parameter (default: `200`)
2. Add `.limit(limit)` and keep `.order('created_at', { ascending: false })`, then reverse in-memory: this fetches the last N messages efficiently
3. Update `getSummarizedHistory()` and `getSlidingWindowHistory()` to use the limited fetch
4. For `ConversationStateService.extractState()`, pass `maxMessagesToAnalyze` (already a config option) directly as the DB limit
5. Keep the unlimited `getAllMessages()` available for admin/export use cases (add a `{ unlimited: true }` option)

### Files affected
- `backend/src/services/message.service.ts`
- `backend/src/services/conversation-state.service.ts`

### Impact / Benefit
- Prevents loading entire conversation history (potentially MB of data) for conversations with hundreds of exchanges
- Reduces DB query time proportionally — fetching 50 rows vs 500 rows is ~10x faster
- Reduces memory pressure on the Node.js process
- Makes the conversation history pipeline scale to long sessions

---

## Item 12 · Cache off-topic pre-check results

### What to do
1. In `runOffTopicPreCheckInternal()`, generate a cache key: `SHA256(question.toLowerCase().trim() + '|' + topicId)`
2. Check `RedisCacheService.get(key, { prefix: 'off-topic-check', ttl: 300 })` before calling OpenAI
3. On result, set the cache with the same key and TTL
4. Add a cache miss/hit counter to the existing latency tracking
5. Log cache hits at debug level

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`

### Impact / Benefit
- Eliminates duplicate LLM calls for repeated questions in research mode (e.g., user asks the same question twice, or refreshes)
- Saves ~$0.0003 per cached hit
- Reduces latency for off-topic pre-check from 300–800ms → ~1ms on cache hit
- Five-minute TTL means the cache stays fresh relative to topic configuration changes

---

## Item 13 · Parallelize off-topic pre-check with RAG retrieval

### What to do
1. In `answerQuestionInternal()`, currently the flow is: off-topic check → (if pass) → RAG retrieval (sequential)
2. Change to: start RAG retrieval in background immediately, then run off-topic check
3. Use `Promise.race` / `Promise.all` pattern:
   ```typescript
   const [onTopic, ragResult] = await Promise.all([
     runOffTopicPreCheckInternal(question, topicName, ...),
     RAGService.retrieveContext(question, ragOptions)
   ]);
   if (!onTopic) { /* discard ragResult, return refusal */ }
   ```
4. If off-topic, the RAG retrieval result is discarded (small wasted cost, offset by saved latency)
5. The tradeoff: ~5–10% queries that fail pre-check waste a RAG retrieval call; but all passing queries are ~500ms faster

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`

### Impact / Benefit
- Reduces total latency for on-topic queries in research mode by 300–800ms (the off-topic pre-check latency)
- For a tool targeting real-time research, this is a meaningful UX improvement
- Off-topic queries have minimal extra cost (RAG result is discarded) — worth the tradeoff

---

## Item 14 · Create `postProcessStream()` to centralize post-stream work

### What to do
1. Create `AIAnswerPipelineService.postProcessStream(fullAnswer, question, userId, request, sources)` method that:
   - Calls `ResponseProcessorService.processFollowUpQuestions()`
   - Calls `ResponseProcessorService.calculateAnswerQualityScore()`
   - Calls citation parsing and validation
   - Calls `MessageService.saveMessagePair()`
   - Calls `QualityMetricsService.collectQualityMetrics()`
   - Calls `CostTrackingService.trackCost()`
   - Returns `{ followUpQuestions, qualityScore, conversationId }`
2. In `ai.routes.ts` streaming handler, replace the inline post-stream block (~lines 432–500) with a single `postProcessStream()` call
3. This method can also be used in future SSE architecture if the pipeline is moved server-side

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/routes/ai.routes.ts`

### Impact / Benefit
- Removes ~80 lines of business logic from the route layer (routes should only handle HTTP concerns)
- Post-stream processing becomes testable (unit test without HTTP)
- Ensures streaming and batch pipeline have identical post-generation behavior
- Makes the route handler lean and auditable in < 50 lines

---

## Item 15 · Add `ErrorBoundary` around chat rendering components

### What to do
1. Create `frontend/components/chat/chat-error-boundary.tsx` — a class component implementing `componentDidCatch` and `getDerivedStateFromError`
2. Display a friendly fallback UI: "Something went wrong rendering this message. [View raw text]" with a toggle to show the raw markdown string
3. Wrap `<ChatMessageList>` in `<ChatErrorBoundary>` inside `chat-container.tsx`
4. Additionally wrap `<EnhancedContentProcessor>` in a per-message boundary so one broken message doesn't crash the entire list
5. Log boundary errors via the existing error tracking service (POST to backend error endpoint or use console.error with a structured payload)

### Files affected
- `frontend/components/chat/chat-error-boundary.tsx` (new)
- `frontend/components/chat/chat-container.tsx`
- `frontend/components/chat/chat-message.tsx`

### Impact / Benefit
- Prevents a single malformed LLM response (e.g., deeply nested markdown table, broken code fence) from crashing the entire chat view
- Without this, one bad message means the user loses access to their entire conversation
- Fallback "view raw text" lets users still read the response even when rendering fails

---

## Item 16 · Fix N+1 conversation metadata queries

### What to do
1. Replace the `Promise.all(conversations.map(async (conv) => getConversationMetadata(conv.id)))` pattern with a single DB query
2. Write a Supabase query using a lateral join or subquery:
   ```sql
   SELECT c.*,
     (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
     (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
     (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
   FROM conversations c
   WHERE c.user_id = $1
   ORDER BY c.updated_at DESC
   LIMIT $2 OFFSET $3
   ```
3. Expose this via a Supabase RPC function `get_conversations_with_metadata(p_user_id, p_limit, p_offset)`
4. Update `ConversationService.getUserConversations({ includeMetadata: true })` to use the RPC call

### Files affected
- `backend/src/services/conversation.service.ts`
- `supabase/migrations/` (new migration)

### Impact / Benefit
- Reduces 100+ DB queries to 1 when loading the conversation list with metadata
- Makes the conversation sidebar load in a single round trip instead of N+1
- Scales correctly regardless of how many conversations the user has

---

## Item 17 · Add chunk page/section metadata to RAG pipeline

### What to do
1. During document ingestion, extract page numbers (for PDFs via `pdf-parse` page breaks) and heading-level section titles (for HTML/DOCX)
2. Store as Pinecone metadata fields: `page_number`, `section_title`, `section_level`
3. Update `ChunkService.createChunks()` to populate these fields in the chunk metadata
4. Update `ContextPipelineService.buildFormattedString()` to include page/section in the formatted context: `[Document 1, page 4, §Introduction]`
5. Update `Source` type to include `pageNumber?: number` and `sectionTitle?: string`
6. Show this provenance in the frontend's `InlineCitation` tooltip: "Page 4 — Introduction"

### Files affected
- `backend/src/services/chunking.service.ts`
- `backend/src/services/chunk.service.ts`
- `backend/src/services/context-pipeline.service.ts`
- `backend/src/services/ai.service.ts` (Source type)
- `frontend/components/chat/inline-citation.tsx`

### Impact / Benefit
- Users can locate the exact source in the original document — critical for academic/professional research
- Page numbers in citations make QueryAI's output usable for external references and reports
- Significantly increases trust in cited sources

---

## Item 18 · Document processing progress tracking

### What to do
1. Add a `processing_status` table (or extend `documents` table) with fields: `document_id`, `stage` (upload/extract/chunk/embed/index), `progress_percent`, `started_at`, `completed_at`, `error`
2. In the document processing queue worker (`rag-worker.ts`), update progress after each stage completes
3. Create `GET /api/documents/:id/status` endpoint returning the current processing stage and progress
4. On the frontend, replace the fake progress bar with real progress polling (poll every 2 seconds while `processing_status !== 'completed'`)
5. Show stage labels: "Extracting text… Splitting into chunks… Creating embeddings… Indexing…"
6. On error, show the specific failed stage and an action to retry

### Files affected
- `backend/src/workers/rag-worker.ts`
- `backend/src/routes/documents.routes.ts`
- `supabase/migrations/` (new table/column)
- `frontend/components/documents/document-manager.tsx`
- `frontend/components/documents/upload-progress.tsx` (new or extend)

### Impact / Benefit
- Replaces the misleading fake progress bar that completes instantly regardless of actual processing state
- Users currently don't know if a document is still processing or failed — they just see "processing" indefinitely
- Stage-level error reporting enables self-service retry instead of contacting support

---

---

# P2 — MEDIUM

---

## Item 19 · Use named SSE events instead of JSON key sniffing

### What to do
1. In `ai.routes.ts` streaming handler, change SSE format from:
   ```
   data: {"chunk":"..."}
   data: {"sources":[...]}
   data: {"done":true}
   ```
   To named events:
   ```
   event: chunk
   data: Hello

   event: sources
   data: [{"type":"web",...}]

   event: done
   data: {}
   ```
2. Update `StreamingService.formatSSEMessage()` to accept `eventName` parameter
3. Update `aiApi.askStream()` in `frontend/lib/api.ts` to use `EventSource` or parse `event:` lines from the raw SSE stream, routing each event type to its handler
4. Remove all `Object.hasOwn(parsed, 'sources')` / `Object.hasOwn(parsed, 'chunk')` JSON key sniffing

### Files affected
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/streaming.service.ts`
- `frontend/lib/api.ts`

### Impact / Benefit
- Eliminates class of bugs where a chunk of text looks like a JSON sources payload (e.g., LLM outputs `{"sources": [...]}`)
- Named events are the SSE standard — more reliable parsing, less fragile
- Easier to add new event types in the future without risking conflicts

---

## Item 20 · Propagate `AbortController` signal to OpenAI API calls

### What to do
1. In `answerQuestionStreamInternal()`, pass the `AbortSignal` through to the OpenAI API call:
   ```typescript
   const stream = await openai.chat.completions.create({
     ...params,
     stream: true,
   }, { signal: abortController.signal });
   ```
2. Accept an optional `abortSignal?: AbortSignal` parameter on `answerQuestionStreamInternal()`
3. In `ai.routes.ts` streaming handler, create an `AbortController` on `req.on('close')` and pass `controller.signal` through to the pipeline
4. Do the same for `answerQuestionInternal()` so non-streaming requests can also be cancelled
5. Handle `AbortError` gracefully — do not log as error, log as info "Stream cancelled by client"

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/services/ai.service.ts`
- `backend/src/routes/ai.routes.ts`

### Impact / Benefit
- When a user cancels mid-stream, the OpenAI API call currently continues generating and consuming tokens until completion
- At 1800 max_tokens and $0.0015/1K tokens, a cancelled 1000-token response wastes ~$0.0015 per cancel
- For a product with many users, cancellations add up to meaningful wasted cost
- Cleaner resource usage — no zombie API calls after client disconnects

---

## Item 21 · Unify history strategy between streaming and non-streaming

### What to do
1. Decide on a single primary history strategy. Recommendation: **sliding window with summarization fallback** (sliding window is deterministic; summarize when token count would exceed budget)
2. In `prepareRequestContext()` (from Item 1), implement this unified strategy once
3. Both pipelines get identical conversation history regardless of which path is used
4. Document the strategy decision in code comments: maximum message count, token budget, summarization trigger threshold
5. Add a test: verify that asking the same question via `/ask` and `/ask/stream` produces the same conversation history input to the LLM

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/services/message.service.ts`

### Impact / Benefit
- Currently streaming and non-streaming can produce different answers to the same question based on different history context
- Debugging is impossible when you can't reproduce behavior deterministically
- Consistent context = consistent answers = user trust

---

## Item 22 · Replace random GPT-4 sampling with deterministic complexity-based selection

### What to do
1. Remove `const useGPT4 = Math.random() < this.PRO_TIER_GPT4_THRESHOLD` from `selectModel()`
2. Expand `isComplexQuery()` with additional signals:
   - Question word count > 30 (likely multi-part)
   - Contains comparison operators or conditional language
   - RAG context > 4000 chars (dense information requiring synthesis)
   - Conversation history length > 10 turns (complex session requiring coherence)
   - Explicit user model preference stored in profile
3. Add a new `MEDIUM_COMPLEXITY` tier that allows GPT-3.5-Turbo-16k or GPT-4o-mini based on clear thresholds
4. Document the exact thresholds as named constants with comments explaining each

### Files affected
- `backend/src/services/ai-answer-pipeline.service.ts`

### Impact / Benefit
- Eliminates non-determinism: the same question always gets the same model
- Makes LLM caching effective for all pro queries (random GPT-4 sampling means cache keys can hit a GPT-3.5 entry with a GPT-4 result or vice versa)
- More predictable billing: operators can predict per-query cost
- Better user experience: complex questions consistently get the better model

---

## Item 23 · Implement LLM-as-judge quality validation (sampled, async)

### What to do
1. Create `backend/src/services/answer-evaluator.service.ts`
2. Implement `evaluateAnswer(question, answer, sources)` that:
   - Asks GPT-4o-mini to evaluate on 3 dimensions: faithfulness (does answer match sources?), relevance (does it address the question?), citation accuracy (do inline links match sources?)
   - Returns structured scores 1–5 for each dimension
3. Call this asynchronously (fire-and-forget) for a sampled 5–10% of queries where `userId` is set
4. Store evaluation results in a new `answer_evaluations` table
5. Expose an admin endpoint `GET /api/admin/quality/evaluations` to view aggregate scores over time
6. Set up a dashboard or periodic report (weekly email) of average scores

### Files affected
- `backend/src/services/answer-evaluator.service.ts` (new)
- `backend/src/routes/admin.routes.ts`
- `supabase/migrations/` (new table)
- `backend/src/services/ai-answer-pipeline.service.ts` (call evaluator as background task)

### Impact / Benefit
- Provides ground-truth quality measurement beyond heuristic scoring (length + formatting)
- Enables data-driven prompt improvements: "prompt change X improved faithfulness score from 3.2 to 4.1"
- Identifies systematic failure modes (e.g., certain topic types consistently score low on faithfulness)
- Foundation for future fine-tuning dataset collection

---

## Item 24 · Virtual message list for long conversations

### What to do
1. Install `@tanstack/react-virtual`: `npm install @tanstack/react-virtual`
2. Refactor `ChatMessageList` to use `useVirtualizer` from `@tanstack/react-virtual`
3. Estimate item height: assistant messages vary widely — use dynamic measurement mode (`measureElement` option)
4. Maintain scroll-to-bottom behavior during streaming (add new messages at the virtual list end)
5. Preserve the scroll position when loading older messages (prepend pattern with scroll anchoring)
6. Test threshold: render a conversation with 200 messages, measure DOM node count before and after

### Files affected
- `frontend/components/chat/chat-message-list.tsx`
- `package.json` (add `@tanstack/react-virtual`)

### Impact / Benefit
- Without virtualization, a 200-message conversation renders ~200 full message DOM trees including markdown, citations, and source components
- Each unvirtualized message can be 50–200 DOM nodes — 200 messages = 10,000–40,000 DOM nodes, causing scroll lag and high memory usage
- Virtualization keeps the rendered DOM count at ~10–20 messages regardless of conversation length

---

## Item 25 · Batch `setMessages` updates on `requestAnimationFrame` during streaming

### What to do
1. In `useChatSend.ts`, instead of calling `setMessages(...)` on every received chunk, accumulate chunks in a `pendingChunks` ref
2. Use `requestAnimationFrame` to flush accumulated chunks to state at most once per frame (~60fps):
   ```typescript
   const pendingChunks = useRef<string[]>([]);
   const rafRef = useRef<number | null>(null);
   
   // In stream loop:
   pendingChunks.current.push(content);
   if (!rafRef.current) {
     rafRef.current = requestAnimationFrame(() => {
       setMessages(prev => /* apply accumulated chunks */);
       rafRef.current = null;
     });
   }
   ```
3. Flush remaining pending chunks immediately when streaming ends
4. Ensure pause/resume still works correctly with the buffering layer

### Files affected
- `frontend/lib/hooks/useChatSend.ts`

### Impact / Benefit
- OpenAI streaming delivers tokens at 30–100 chunks/second; each chunk currently triggers a React state update and re-render of the entire message thread
- `requestAnimationFrame` batching caps React re-renders at 60fps max regardless of token delivery rate
- Reduces CPU usage during streaming, preventing dropped frames and input lag if user types while streaming

---

## Item 26 · Persist BM25 index to Redis

### What to do
1. After BM25 index construction, serialize the index to JSON or a binary format
2. Store in Redis with key `bm25:index:{userId}` (or a global key if the index is shared)
3. On server startup or on first hybrid search request, check Redis for a cached index before rebuilding
4. Invalidate the cache when new documents are indexed (on document upload success)
5. Use Redis TTL of 24 hours as a safety expiry (force rebuild daily at minimum)
6. Track BM25 index size in logs to monitor growth

### Files affected
- `backend/src/services/hybrid-search.service.ts`
- `backend/src/services/redis-cache.service.ts`

### Impact / Benefit
- Currently BM25 index is rebuilt from scratch in-memory on every server restart (or potentially per-request)
- On server restart, the first hybrid search query for each user incurs full index rebuild time
- With Redis persistence, the index survives restarts and is shared across horizontal scale-out instances
- Eliminates the inconsistency where newly deployed instances have empty BM25 indexes

---

## Item 27 · Remove overlapping context compression/summarization services

### What to do
1. Audit `ContextCompressorService` and `ContextSummarizerService` — document what each does and where they overlap
2. Decision: keep the one that produces higher quality output (likely the LLM-based summarizer) and remove the simpler one
3. Update all callers that used the removed service to use the survivor
4. Remove the `enableContextCompression` / `enableContextSummarization` dual toggle from `QuestionRequest` — replace with a single `contextReductionStrategy: 'compress' | 'summarize' | 'none'` option
5. Update RAGOptions and all config files accordingly

### Files affected
- `backend/src/services/context-compressor.service.ts` (likely to be removed/merged)
- `backend/src/services/context-summarizer.service.ts`
- `backend/src/services/ai-answer-pipeline.service.ts`
- `backend/src/services/ai.service.ts` (QuestionRequest interface)

### Impact / Benefit
- Two services doing overlapping jobs causes confusion about which to use and can result in double-compression
- Simpler configuration: one option instead of two boolean flags
- Reduces bundle of services that need to be maintained and tested
- Clearer mental model for developers adding new features

---

---

# P3 — FUTURE (Research-Grade Features)

---

## Item 28 · Response regeneration with different parameters

### What to do
1. Add "Regenerate" button in `ChatMessage` for assistant messages — renders on hover with options: "Same settings", "More sources", "Less detail", "Use GPT-4"
2. Backend: `POST /api/ai/regenerate` accepting `{ messageId, options: Partial<QuestionRequest> }`:
   - Fetch the original user message from the conversation
   - Re-run the full pipeline with merged options
   - Either replace the existing assistant message in DB or create a new version
3. Frontend: show the new response in place of the old one with a "Version 1 / Version 2" toggle if keeping history
4. If keeping version history (see Item 29), store `response_version` in message metadata

### Files affected
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/ai-answer-pipeline.service.ts`
- `frontend/components/chat/chat-message.tsx`
- `frontend/lib/api.ts`

### Impact / Benefit
- Users can get a better answer without losing the conversation context
- Enables self-correction: if a response missed key sources, regenerate with more chunks
- Premium feature differentiator — research tools like Perplexity Pro offer this

---

## Item 29 · Answer version history and comparison

### What to do
1. Add `version` field to `messages` table (default 1), and `parent_message_id` for linking versions
2. When a message is regenerated (Item 28) or edited, increment version and link to parent
3. Frontend: show a version indicator ("v1 | v2 | v3") on messages with multiple versions — clicking switches view
4. "Compare" mode: side-by-side diff view of two response versions (highlight changed sentences)
5. Admin analytics: track which regenerations improve quality score (vs original)

### Files affected
- `supabase/migrations/` (alter messages table)
- `backend/src/services/message.service.ts`
- `frontend/components/chat/chat-message.tsx`
- `frontend/components/chat/message-version-compare.tsx` (new)

### Impact / Benefit
- Research requires traceability — "how did my answer change when I added Document X?"
- Side-by-side comparison helps users understand how source selection affects answers
- Creates dataset of (original answer, improved answer) pairs for future fine-tuning

---

## Item 30 · Citation click-through analytics

### What to do
1. When a user clicks an `InlineCitation` to open a source URL, fire a tracking event to the backend: `POST /api/analytics/citation-click { messageId, sourceIndex, sourceUrl, sourceType }`
2. Store in a `citation_clicks` analytics table: `user_id`, `conversation_id`, `message_id`, `source_url`, `source_type`, `clicked_at`
3. Aggregate: "most clicked sources per topic", "citation click-through rate by source domain", "unclicked citations (cited but never accessed)"
4. Use this data to weight source quality in future RAG retrieval: sources that users actually click are more valuable
5. Admin dashboard: show click-through rates per source domain

### Files affected
- `frontend/components/chat/inline-citation.tsx`
- `backend/src/routes/analytics.routes.ts`
- `supabase/migrations/` (new table)

### Impact / Benefit
- Currently there's no signal for whether sources are actually useful to users
- Click-through data is the closest proxy to "was this citation helpful?"
- Enables feedback loop: boost domains with high click-through in RAG ranking
- Privacy consideration: obfuscate URLs in logs, store domain only if needed

---

## Item 31 · Full conversation export with bibliography

### What to do
1. Create `GET /api/conversations/:id/export?format=pdf|markdown|docx` endpoint
2. Generate export using a template:
   - Title: conversation title + date
   - Body: Q&A exchange with formatted answers (markdown stripped to clean prose)
   - Per-message source footnotes: "[1] Source Title (URL, accessed DATE)"
   - End matter: full bibliography with all unique sources, deduplicated
3. For PDF: use `pdfkit` or `puppeteer` to render markdown to PDF
4. For DOCX: use `docx` npm package with styled paragraphs
5. Frontend: "Export Conversation" button in conversation options menu, format selector modal

### Files affected
- `backend/src/routes/conversations.routes.ts`
- `backend/src/services/export.service.ts` (new)
- `frontend/components/chat/conversation-options.tsx`

### Impact / Benefit
- Research output must be shareable in standard formats — this is table stakes for a research tool
- Answers with proper bibliography can be used in reports, papers, and presentations directly
- High-value feature for professional/academic users (premium tier differentiator)

---

## Item 32 · Cross-conversation citation tracking

### What to do
1. When saving a message, extract all cited source URLs/documentIds and upsert into a `cited_sources` table: `user_id`, `source_url`, `source_type`, `document_id`, `first_cited_at`, `citation_count`
2. Create `GET /api/analytics/cited-sources` returning the user's most-cited sources, filterable by topic and date range
3. Frontend: "My Sources" panel in the research sidebar showing top cited sources across all conversations
4. "Source explorer": click a source to see all conversations where it was cited, with snippets
5. Aggregate per-topic: "Sources most relied on in Topic: AI Ethics"

### Files affected
- `backend/src/services/message.service.ts`
- `backend/src/routes/analytics.routes.ts`
- `supabase/migrations/` (new table)
- `frontend/components/research/cited-sources-panel.tsx` (new)

### Impact / Benefit
- Researchers naturally return to the same sources — surfacing their citation history saves time
- "Source explorer" reveals implicit research patterns the user may not be aware of
- Enables "follow this source" feature: get notified when a frequently-cited domain publishes new content

---

## Item 33 · Stream non-answer generation (essays, reports, summaries)

### What to do
1. Add streaming variants to `AIGenerationService`: `generateDetailedReportStream()`, `writeEssayStream()`, `summarizeResponseStream()`
2. Add SSE streaming endpoints: `POST /api/ai/report/stream`, `POST /api/ai/essay/stream`, `POST /api/ai/summarize/stream`
3. Follow the same SSE pattern as `/ask/stream`: yield text chunks, send `{ done: true }` at end
4. Frontend: update the action response handlers in `ChatContainer` to consume the stream using the same `useChatSend` hook (or a simplified variant for action responses)
5. Show report/essay generation with a streaming "writing..." indicator, not a spinner

### Files affected
- `backend/src/services/ai-generation.service.ts`
- `backend/src/routes/ai.routes.ts`
- `frontend/components/chat/chat-container.tsx`
- `frontend/lib/api.ts`

### Impact / Benefit
- Reports/essays can be 2000–4000 tokens — users currently wait 5–15 seconds with no feedback
- Streaming reduces perceived wait time dramatically (first words appear within 1 second)
- Consistent UX: all AI generation in the app is streaming

---

## Item 34 · User feedback loop (rate answers, flag bad citations)

### What to do
1. Add thumbs up/down buttons and optional free-text comment to each assistant message in `ChatMessage`
2. Backend: `POST /api/feedback { messageId, rating: 1|-1, comment?: string, flaggedCitations?: string[] }`
3. Store in `message_feedback` table with `user_id`, `message_id`, `rating`, `comment`, `flagged_citations`, `created_at`
4. "Flag citation" action per `InlineCitation`: marks a specific source as "not supporting the claim"
5. Admin dashboard: aggregate thumbs up/down rates by model, topic, and time period
6. Automatically route 0-rated responses to the LLM-as-judge pipeline (Item 23) for analysis

### Files affected
- `frontend/components/chat/chat-message.tsx`
- `frontend/components/chat/inline-citation.tsx`
- `backend/src/routes/feedback.routes.ts` (new)
- `supabase/migrations/` (new table)
- `backend/src/routes/admin.routes.ts`

### Impact / Benefit
- Creates direct signal from users about response quality
- Flagged citations identify hallucinated or mismatched sources — the most critical quality issue for a research tool
- Negative feedback can trigger automatic re-generation (future: if thumbs down, auto-regenerate with different sources)
- Builds a labeled dataset for fine-tuning: (question, context, answer, rating) tuples

---

## Item 35 · Multi-hop retrieval for complex questions

### What to do
1. Implement a query decomposition step in `RetrievalOrchestratorService`: detect complex multi-part questions (reuse `isComplexQuery()` logic) and decompose into 2–3 sub-questions using a lightweight LLM call
2. Retrieve context for each sub-question independently via Pinecone + BM25
3. Merge retrieved chunks, deduplicate, and re-rank the unified set
4. Pass the merged context to the main LLM call with instruction: "The question has multiple parts. Here are contexts for each sub-question: ..."
5. Fallback: if decomposition fails or produces poor sub-questions (detected by empty retrieval), run as a single-hop query
6. Log sub-question count and retrieval counts per hop for analytics

### Files affected
- `backend/src/services/retrieval-orchestrator.service.ts`
- `backend/src/services/rag.service.ts`
- New: `backend/src/services/query-decomposer.service.ts`

### Impact / Benefit
- Complex research questions often require synthesizing information from multiple distinct contexts
- Single-hop retrieval for "Compare the AI policies of the US and EU in 2024" retrieves chunks about either US or EU policy but rarely both in one context window
- Multi-hop retrieval returns dedicated context for each sub-question, enabling genuine synthesis
- Particularly valuable for comparative analysis, temporal comparisons, and multi-entity questions

---

## Item 36 · Research workspace view with document-topic graph

### What to do
1. Create `frontend/app/workspace/page.tsx` — a dedicated research workspace view
2. Use `@xyflow/react` (React Flow) to render a graph where:
   - Topics are large nodes (colored by category)
   - Documents are smaller nodes connected to their assigned topics
   - Conversations are connected to their topic node
   - Edge thickness represents activity (number of conversations)
3. Click a topic node → open that topic's chat
4. Click a document node → open document viewer
5. "Research map" panel: shows which documents have been cited most across all conversations in a topic
6. Backend: `GET /api/research/workspace` returning the graph data structure (topics + documents + conversation counts + citation counts)

### Files affected
- `frontend/app/workspace/page.tsx` (new)
- `frontend/components/workspace/research-graph.tsx` (new)
- `backend/src/routes/workspace.routes.ts` (new)
- `frontend/package.json` (add `@xyflow/react`)

### Impact / Benefit
- Transforms QueryAI from a chat interface into a visual research environment
- Users can see the shape of their research: which topics are rich (many documents) vs thin
- Graph reveals document-topic relationships that are impossible to see in a linear document list
- High-differentiation feature: few research tools offer this visualization

---

## Item 37 · Topic hierarchy and nesting

### What to do
1. Add `parent_topic_id UUID REFERENCES topics(id)` column to the `topics` table via migration
2. Update `TopicService.createTopic()` to accept optional `parentTopicId`
3. Update `TopicService.getTopics()` to return tree structure (topics with nested `children` array)
4. Update the RAG retrieval query: when a sub-topic is active, also retrieve documents from the parent topic (fallback to broader context)
5. Frontend topic selector: replace flat dropdown with a tree component (expand/collapse parent topics to reveal sub-topics)
6. Breadcrumb navigation in research mode: "AI Policy > EU Regulation > GDPR"
7. Metrics: tag conversations with both sub-topic and all ancestor topics for analytics rollup

### Files affected
- `supabase/migrations/` (alter topics table)
- `backend/src/services/topic.service.ts`
- `backend/src/services/topic-query-builder.service.ts`
- `frontend/components/topics/topic-tree-selector.tsx` (new)
- `frontend/components/chat/chat-container.tsx` (breadcrumb)

### Impact / Benefit
- Real research is hierarchical: "US Trade Policy" lives under "International Economics" lives under "Economics"
- Nested topics allow users to work at varying levels of specificity without duplicating documents
- Sub-topic queries can inherit documents from parent topics, reducing manual document assignment
- Breadcrumb navigation gives users a spatial sense of where they are in their research taxonomy

---

---

## Summary Table

| # | Item | Priority | Estimated Effort | Key Benefit |
|---|------|----------|-----------------|-------------|
| 1 | Extract shared `prepareRequest()` | P0 | 2–3 days | Eliminates 400-line duplication, single source of truth |
| 2 | Condense system prompt to <1000 tokens | P0 | 1 day | Saves ~$0.004/query, reduces model confusion |
| 3 | Zod validation for `QuestionRequest` | P0 | 1 day | Catches silent option bugs, forces typed API |
| 4 | Unify frontend citation processing | P0 | 1–2 days | Fixes double/missed citation rendering bug |
| 5 | Add `topicId` to LLM cache key | P0 | 2 hours | Fixes cache correctness bug in research mode |
| 6 | Real cross-encoder reranking (Cohere) | P0 | 1 day | Highest single quality improvement to RAG |
| 7 | Refactor 1572-line documents route | P0 | 2 days | Maintainability, enables unit testing |
| 8 | Structured outputs for citations/follow-ups | P1 | 2–3 days | Eliminates regex parsing, guaranteed format |
| 9 | Wire up `conversationStateText` | P1 | 4 hours | Makes entity/topic tracking actually work |
| 10 | Atomic `saveMessagePair()` | P1 | 4 hours | Prevents data loss on save failure |
| 11 | DB-level LIMIT on message fetch | P1 | 2 hours | Prevents megabyte loads for long conversations |
| 12 | Cache off-topic pre-check | P1 | 3 hours | Saves ~$0.0003/query + 500ms latency |
| 13 | Parallelize pre-check + RAG | P1 | 3 hours | Saves 300–800ms per research-mode query |
| 14 | `postProcessStream()` centralization | P1 | 4 hours | Moves business logic out of route layer |
| 15 | `ErrorBoundary` around chat | P1 | 3 hours | Prevents full chat crash on bad LLM output |
| 16 | Fix N+1 conversation metadata | P1 | 4 hours | 100 DB queries → 1 for sidebar load |
| 17 | Chunk page/section metadata | P1 | 2–3 days | Precise source provenance in citations |
| 18 | Document processing progress tracking | P1 | 2 days | Real progress bar replacing fake one |
| 19 | Named SSE events | P2 | 4 hours | Eliminates JSON key sniffing ambiguity |
| 20 | AbortController to OpenAI API | P2 | 3 hours | Stops wasting tokens on cancelled requests |
| 21 | Unified history strategy | P2 | 4 hours | Deterministic answers across both paths |
| 22 | Deterministic model selection | P2 | 2 hours | Predictable quality, effective caching |
| 23 | LLM-as-judge quality evaluation | P2 | 2 days | Data-driven quality measurement |
| 24 | Virtual message list | P2 | 2 days | Scales to 200+ message conversations |
| 25 | Batch streaming state updates | P2 | 3 hours | Smooth streaming at high token speeds |
| 26 | Persist BM25 to Redis | P2 | 4 hours | Survives restarts, scales horizontally |
| 27 | Remove overlapping compression services | P2 | 4 hours | Simpler codebase, clearer config |
| 28 | Response regeneration | P3 | 3–4 days | Users get better answers without losing context |
| 29 | Answer version history + comparison | P3 | 3–4 days | Research traceability, fine-tuning dataset |
| 30 | Citation click-through analytics | P3 | 2 days | Quality signal from user behavior |
| 31 | Conversation export with bibliography | P3 | 3 days | Research output in standard formats |
| 32 | Cross-conversation citation tracking | P3 | 2 days | Surfaces citation patterns and source value |
| 33 | Streaming for essays/reports/summaries | P3 | 2 days | Removes 5–15 second frozen wait |
| 34 | User feedback + citation flagging | P3 | 2–3 days | Direct quality signal, labeled dataset |
| 35 | Multi-hop retrieval | P3 | 4–5 days | Better context for complex multi-part questions |
| 36 | Research workspace graph view | P3 | 1–2 weeks | Visual research environment, differentiator |
| 37 | Topic hierarchy and nesting | P3 | 4–5 days | Hierarchical research taxonomy with inheritance |

---

## Suggested Sprint Sequence

### Sprint 1 (Week 1–2): P0 Critical Fixes
Items: 1, 2, 3, 4, 5, 6, 7
Focus: correctness, cost reduction, and maintainability before any new features.

### Sprint 2 (Week 3–4): P1 Reliability & Quality
Items: 8, 9, 10, 11, 12, 13, 14, 15, 16
Focus: data integrity, latency reduction, and quality pipeline completeness.

### Sprint 3 (Week 5): P1 Data & UI
Items: 17, 18
Focus: richer source provenance and real document processing feedback (both require schema migrations).

### Sprint 4 (Week 6–7): P2 Efficiency & UX
Items: 19, 20, 21, 22, 23, 24, 25, 26, 27
Focus: smooth streaming, deterministic behavior, and performance.

### Sprint 5+ (Week 8+): P3 Research Features
Items: 28–37 in order of user demand and available engineering capacity.
