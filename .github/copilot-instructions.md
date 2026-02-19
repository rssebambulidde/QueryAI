# Copilot Instructions — QueryAI

## Stack & Layout

- **Backend**: Node.js + Express + TypeScript → `backend/src/` — deployed on **Railway**
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS → `frontend/` — deployed on **Cloudflare Pages**
- **Database**: Supabase (PostgreSQL + Auth + Storage). Vector DB: Pinecone. AI: OpenAI API. Web search: Tavily.
- **Tests**: Jest (backend only). Run after every backend change: `cd backend && npx jest --testPathPatterns="<service>"`

## Critical Architecture — Thin Coordinators

`ai.service.ts` and `rag.service.ts` are **thin coordinators** — they own canonical types and delegate all work. Never add heavy logic to them; create or extend a specialised service instead.

```
AI pipeline:  ai.service → ai-answer-pipeline.service → prompt-builder.service → OpenAI
RAG pipeline: rag.service → retrieval-orchestrator.service → context-pipeline.service → Pinecone / Tavily
```

Streaming uses **SSE over POST** (not WebSocket). Sources arrive first, then text chunks, then follow-up questions.

## Backend Patterns

- **Services are static classes** in `backend/src/services/<domain>.service.ts` (~100 files). Call as `ConversationService.getConversation(...)`, never instantiate.
- **No controller layer for most routes** — handler logic lives inline in route files wrapped with `asyncHandler`. Only `document.controller.ts` exists. Don't create new controller files.
- **Lazy imports** break circular deps: `const { TopicService } = await import('./topic.service');` — preserve this pattern when you see it.
- **Config & logger imports**: `import config from '../config/env'` and `import logger from '../config/logger'` (both in `config/`, not `utils/`).
- **DB client**: `import { supabaseAdmin } from '../config/database'` — always use `supabaseAdmin` (service-role), never the anon client.
- **Env vars**: Access via `config.SOME_VAR` (validated singleton from `config/env.ts`), not `process.env` directly.
- **Backend imports use relative paths** (`'../config/env'`, `'./topic.service'`). The `@/` aliases in `tsconfig.json` are declared but unused — keep using relative imports for consistency.
- **Error classes** live in `types/error.ts`: `AppError`, `ValidationError` (400), `AuthenticationError` (401), `AuthorizationError` (403), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429). Throw from services — the global `errorHandler` middleware catches them.
- **JSON response shape**: Always `{ success: true, data: ... }` or `{ success: false, error: { message, code? } }`.

## Route Middleware Stacking

Routes stack middleware in this order (see `ai.routes.ts` for canonical example):
```ts
router.post('/ask',
  validateRequest(QuestionRequestSchema),  // Zod validation BEFORE auth (fail-fast)
  authenticate,                             // JWT → req.user { id, email }
  tierRateLimiter,                         // per-user, tier-based
  enforceQueryLimit,                       // monthly query limit
  asyncHandler(async (req, res) => { ... })
);
```
- `req.user` has only `{ id: string, email: string }` — no role/tier on the user object. Type augmented in `types/express.d.ts`.
- `req.subscription` and `req.subscriptionLimits` are set by `checkSubscription` middleware (separate from auth).

## Supabase & Migrations

- **Table queries**: `supabaseAdmin.from('table').select/insert/update().eq(...)` — check `error` on every call.
- **Private-schema RPCs** (transactional ops): `supabaseAdmin.schema('private').rpc('fn_name', { p_param: value })` — RPC params prefixed with `p_`.
- **Migrations**: Sequential SQL files in `backend/src/database/migrations/` (latest: `036`). Next migration = `037_*.sql`. Always include `REVOKE ALL` / `GRANT EXECUTE` for security. Run manually via Supabase SQL Editor.
- **PostgREST injection**: Use `sanitizePostgrestValue()` / `sanitizeLikeValue()` from `validation/sanitize.ts` when building `.or()`, `.filter()`, or `.ilike()` queries.

## Frontend Patterns

- **Path alias**: `@/` maps to `frontend/` root — e.g. `@/components/ui/button`, `@/lib/store/auth-store`.
- **API calls**: Use the Axios wrapper in `lib/api.ts` (handles auth headers, token refresh, 401 retry). For streaming, `aiApi.askStream()` uses raw `fetch` and returns an `AsyncGenerator` yielding `string | metadata`.
- **State**: Zustand stores in `lib/store/` with `persist` middleware. Tokens are dual-written to Zustand state AND `localStorage` (Axios interceptor reads from localStorage).
- **Components**: Domain folders under `components/` (chat, admin, sidebar, documents). Shared primitives in `components/ui/`.
- **API namespaces**: `authApi`, `aiApi`, `conversationApi`, `documentApi` etc. — use these, don't call `fetch`/`axios` directly.
- **Auth guards are client-side only** — dashboard pages redirect via `useEffect` + `useAuthStore()`. Admin pages wrap children in `<AdminGuard>` (checks role hierarchy via `useUserRole()` hook). No Next.js middleware auth.

## Streaming (SSE) Protocol

The SSE stream yields events in this order. The frontend `useChatSend` hook in `lib/hooks/useChatSend.ts` consumes via `for await...of`:
```
data: {"sources":[...]}             ← arrives FIRST
data: {"chunk":"text"}              ← answer text (many events)
data: {"followUpQuestions":[...]}   ← after answer completes
data: {"qualityScore":0.85}         ← optional
data: {"done":true}                 ← only on refusal/empty
```
Backend: `ai-answer-pipeline.service.ts` uses `async function*` → route writes each yield as `res.write('data: ...\n\n')`.
Frontend: `aiApi.askStream()` (`async function*`) parses SSE lines → `useChatSend` discriminates chunks by `typeof chunk === 'string'` vs `'sources' in chunk`.

## Testing

Tests in `backend/src/__tests__/` mirror service filenames. Integration tests (multi-service) live separately in `backend/src/integration/`. Mock Supabase — never hit real DB:
```ts
const supabaseAdmin = {
  from: jest.fn(() => chainable),
  rpc: jest.fn(),
  schema: jest.fn(() => ({ rpc: rpcMock })),  // for private-schema RPCs
};
```
Test setup (`__tests__/setup.ts`) stubs all env vars. After adding a new RPC, add a test that mocks `schema('private').rpc(...)`.

## Background Jobs & Scripts

- **Cron**: Functions in `cron/` are exposed as `POST /api/jobs/*` endpoints in `server.ts` (HTTP-triggered, not in-process schedulers). Triggered externally by Railway Cron.
- **Workers**: `workers/rag-worker.ts` uses BullMQ with Redis. Static class pattern. Gracefully no-ops when Redis isn't configured.
- **Scripts**: CLI scripts in `scripts/` run via `npx tsx src/scripts/<name>.ts`. All support `--dry-run`, use manual `parseArgs()`, and call `process.exit(0/1)`.

## Git Workflow

- **`main`**: Production — only stable, tested code.
- **`development`**: Active integration branch.
- **`feature/*`**: Branch from `development` for individual features/fixes.

## Key Rules

| Do | Don't |
|---|---|
| Put business logic in `*.service.ts` files | Add logic to thin coordinators or route files |
| Use `supabaseAdmin` from `config/database` | Use the anon Supabase client on the backend |
| Number migrations sequentially (next: `037_...`) | Skip or reuse migration numbers |
| Derive types from Zod schemas (`z.infer<>`) | Duplicate type definitions manually |
| Use structured JSON output (`response_format`) for AI | Parse free-text AI responses with regex |
| Throw typed errors from `types/error.ts` | Swallow errors or send raw `res.status().json()` |
| Use `@/` path aliases in frontend imports | Use deep relative paths (`../../../`) in frontend |
| Use relative imports in backend (`'../config/env'`) | Use `@/` aliases in backend (declared but unused) |
