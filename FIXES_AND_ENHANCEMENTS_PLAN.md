# QueryAI – Fixes and Enhancements Plan

This document outlines a structured plan for the requested fixes and enhancements across the QueryAI codebase (frontend, backend, and shared logic).

---

## 1. Landing Page – Minimal Design and Content

**Goal:** Simplify the landing page with minimal design and content; replace "QueryAI" text with a logo.

**Scope:**
- **File:** `frontend/app/page.tsx`
- **Actions:**
  - Reduce copy, hero section, and FAQ/content to a minimal set (e.g. one short value proposition, one CTA).
  - Replace the "QueryAI" text in the header/hero with a logo component (use existing `frontend/components/logo.tsx` or add/update logo asset in `public/`).
  - Simplify layout and styling (fewer sections, cleaner typography, less visual noise).
- **Reference:** User image indicates "Replace with logo" at top-left branding.

---

## 2. Conversation Selection – Open Conversation Thread, Not Sources

**Goal:** When a conversation is selected in the sidebar, the main area must show the **conversation thread** (messages), not the sources view.

**Scope:**
- **Files:** `frontend/app/dashboard/page.tsx`, `frontend/components/chat/chat-interface.tsx`, `frontend/components/sidebar/app-sidebar.tsx`
- **Current behavior:** Selecting a conversation may show sources in the main content (or sources are too prominent).
- **Actions:**
  - Ensure that when `activeTab === 'chat'` and a conversation is selected (`currentConversationId` set via `selectConversation`), the main content is **always** the chat thread (messages list + input).
  - Do **not** render a full-page or primary "Sources" view when only a conversation is selected; sources should be secondary (see item 3).
  - Verify `ChatInterface` receives `currentConversationId` from the store and loads messages; ensure no conditional that replaces the thread with a sources-only view on conversation select.

---

## 3. Response Sources – End of Response, Collapsible (Chevron)

**Goal:** Show response sources **only at the end of each response**, with a collapse/expand chevron so they do not intrude on the conversation thread.

**Scope:**
- **Files:** `frontend/components/chat/chat-interface.tsx`, `frontend/components/chat/chat-message.tsx`, `frontend/components/chat/source-panel.tsx`
- **Actions:**
  - **Per-message sources:** For each assistant message that has `sources`, render a compact "Sources" block **directly below that message** (not in a separate right-hand or full-width panel that replaces the thread).
  - **Collapsible:** Default state **collapsed** (e.g. "Sources (5)" with chevron down). Click to expand and show the list; chevron up when expanded.
  - **Remove or reduce:** The current `SourcePanel` that shows sources for the "last" assistant message in a prominent panel; either remove it or repurpose it so that the main conversation view is the thread, with sources only as inline, per-message, collapsible sections.
  - Ensure the conversation thread remains the primary focus; sources are secondary and scoped to each response.

---

## 4. Action Buttons (Summarise, etc.) – Ellipsis Menu at End of Response

**Goal:** Move action buttons (e.g. Summarise and others) into a single **ellipsis (...) menu** at the end of each response instead of separate visible buttons.

**Scope:**
- **Files:** `frontend/components/chat/chat-message.tsx`, `frontend/components/chat/chat-interface.tsx`
- **Actions:**
  - Add an ellipsis (e.g. `MoreHoriz` or three-dots) control at the end of each assistant message.
  - On click, show a dropdown/popover with actions: e.g. "Summarise", and any other message-level actions.
  - Remove or hide the previous standalone action buttons for these actions from the message footer.
  - Wire the ellipsis menu actions to the same handlers used for summarise and other features.

---

## 5. Suggested Follow-Up Questions – RAG Flow and Formatting

**Goal:** Ensure suggested follow-up questions use the **same RAG flow and logic** as the original message, and that their responses use the **same formatting and style**.

**Scope:**
- **Frontend:** `frontend/components/chat/chat-interface.tsx`, `frontend/components/chat/chat-message.tsx` (where follow-ups are rendered and clicked).
- **Backend:** `backend/src/routes/ai.routes.ts`, `backend/src/services/rag.service.ts` (or equivalent question/answer pipeline).
- **Actions:**
  - When a user clicks a suggested follow-up question, send it through the **same** question/answer API and RAG pipeline as the original user message (same endpoint, same request shape, same retrieval + generation flow).
  - Do not use a different endpoint or a simplified path for follow-ups; reuse the main `ask`/`question` flow so that document search, web search, and citation logic are identical.
  - Ensure the response for follow-ups is rendered with the **same** components and styling as normal assistant messages (same message bubble, citation style, source handling, and formatting).
  - Review any `followUpQuestions` parsing and the click handler; ensure the clicked text is sent as the next user message and the reply is appended to the same conversation with the same UI treatment.

---

## 6. Remove API Keys and Embeddings Features – Codebase Cleanup

**Goal:** Remove the API Keys and Embeddings features from the app and clean all related code.

**Scope:**

**Frontend:**
- **Sidebar:** `frontend/components/sidebar/app-sidebar.tsx` – Remove "API Keys" and "Embeddings" from `TabType` and from nav (expanded and collapsed).
- **Dashboard:** `frontend/app/dashboard/page.tsx` – Remove `api-keys` and `embeddings` from tab handling; remove imports and rendering of `ApiKeyManager` and `EmbeddingManager`.
- **Components:** Remove or deprecate `frontend/components/api-keys/api-key-manager.tsx` and `frontend/components/embeddings/embedding-manager.tsx` (or keep files but do not reference them).
- **API:** `frontend/lib/api.ts` – Remove or stub API key and embedding client methods if no longer used.
- **URL/query:** Ensure no `?tab=api-keys` or `?tab=embeddings` links remain; update any redirects or default tabs.

**Backend:**
- **Routes:** Remove or disable `backend/src/routes/api-keys.routes.ts` and `backend/src/routes/embeddings.routes.ts` (and any embed.routes that are only for embeddings).
- **Services:** Remove or stop using `backend/src/services/api-key.service.ts` and `backend/src/services/embedding.service.ts` (or equivalent) for API key/embedding features.
- **App registration:** Unregister API Keys and Embeddings routes from the main Express app.
- **Database:** Optionally keep tables for future use but do not expose them via UI or public API; or add a migration to drop/rename if product decision is permanent.

**Other:**
- Search codebase for `api-keys`, `apiKeys`, `embeddings`, `EmbeddingManager`, `ApiKeyManager` and remove or update references.
- Update docs (e.g. README, ARCHITECTURE) to remove references to API Keys and Embeddings.

---

## 7. Subscription, Documents, and Topics Under Settings; Rename "Your Documents"

**Goal:** Move Subscription, Documents, and Topics into **Settings** (as sub-pages or tabs). Rename "Your Documents" to **"Documents"**.

**Scope:**
- **Settings layout:** `frontend/app/dashboard/settings/layout.tsx` – Extend `settingsNav` to include:
  - Subscription (link to e.g. `/dashboard/settings/subscription` or in-page tab)
  - Documents (link to e.g. `/dashboard/settings/documents`)
  - Topics (link to e.g. `/dashboard/settings/topics`)
- **Routes/pages:** Either:
  - Add `frontend/app/dashboard/settings/subscription/page.tsx`, `documents/page.tsx`, `topics/page.tsx` that render the existing `SubscriptionManager`, `DocumentManager`, `TopicManager`, or
  - Use the same layout with a tab or query param to switch between Profile, Search, Citations, Advanced RAG, **Subscription**, **Documents**, **Topics**.
- **Sidebar:** `frontend/components/sidebar/app-sidebar.tsx` – Remove top-level tabs for "Subscription", "Your Documents", and "Topics". Keep a single **Settings** entry that goes to the settings layout; from there users reach Subscription, Documents, Topics.
- **Dashboard main content:** `frontend/app/dashboard/page.tsx` – Remove rendering of Subscription, Documents, and Topics from the main dashboard content area when those are no longer tabs; adjust `TabType` to exclude `subscription`, `documents`, `topics` (or keep only for redirect to settings).
- **Rename:** All visible labels "Your Documents" → "Documents" (sidebar, settings nav, page titles).
- **Mobile:** Update `frontend/components/mobile/bottom-navigation.tsx` and `frontend/components/mobile/mobile-sidebar.tsx` so Subscription, Documents, Topics are accessed via Settings, not as top-level items.

---

## 8. Profile Image / Profile Update – Fix 404

**Goal:** Fix "Request failed with status code 404" when saving profile (including profile image/avatar) under Settings.

**Scope:**
- **Backend:** The frontend calls `PUT /api/auth/profile` (see `frontend/lib/api.ts` – `authApi.updateProfile`). The backend has **no** `PUT /api/auth/profile` route (only `GET /api/auth/me` in `backend/src/routes/auth.routes.ts`), which causes 404.
- **Actions:**
  - Add `PUT /api/auth/profile` in `backend/src/routes/auth.routes.ts` (authenticated).
  - Handler should accept e.g. `full_name`, `avatar_url` (and optionally file upload if you add avatar upload). If avatar is uploaded as file, backend should store it (e.g. Supabase Storage), set `avatar_url` on the user profile, and return the new URL.
  - In `backend/src/services/database.service.ts`, `updateUserProfile` already exists; ensure it supports `avatar_url` and `full_name`. Ensure `user_profiles` has an `avatar_url` (or equivalent) column.
  - If profile image is uploaded as file: add an upload endpoint (e.g. `POST /api/auth/profile/avatar`) that returns the URL, then frontend calls `PUT /api/auth/profile` with that `avatar_url`; or have `PUT /api/auth/profile` accept multipart and handle upload internally.
  - Frontend: ensure `ProfileEditor` calls the correct endpoint and sends the payload the backend expects (e.g. `full_name`, `avatar_url`). Remove or fix any incorrect profile/avatar URL that might call a non-existent path.

---

## 9. Settings – Navigation Back to Home / Conversation

**Goal:** Provide clear navigation from the Settings page back to the main app (home or conversation).

**Scope:**
- **Files:** `frontend/app/dashboard/settings/layout.tsx`, optionally a shared header/breadcrumb component.
- **Actions:**
  - Add a visible "Back to dashboard" or "Back to conversations" link/button at the top of the Settings layout (e.g. next to the "Settings" title or above the sidebar). Link to `/dashboard` (or `/dashboard?tab=chat`).
  - Optionally add a breadcrumb: e.g. "Dashboard > Settings > Profile".
  - Ensure that from any Settings sub-page (Profile, Search, Citations, Advanced RAG, Subscription, Documents, Topics) the user can get back to the main dashboard in one click without using browser back.

---

## 10. Enterprise Plan – Self-Enrollment

**Goal:** Allow users to self-enroll in the Enterprise plan (e.g. payment flow similar to other tiers) instead of only "Contact sales".

**Scope:**
- **Frontend:** `frontend/components/subscription/subscription-manager.tsx` – Replace or complement "Contact sales" / "Get Enterprise" with a self-serve flow: e.g. "Upgrade to Enterprise" that leads to a price and payment (PayPal/card) like other tiers. If Enterprise has a custom price, show a fixed price or "Contact for quote" only if necessary.
- **Backend:** Payment and subscription logic – Ensure subscription/payment routes and services support `tier: 'enterprise'` (e.g. `backend/src/routes/subscription.routes.ts`, `backend/src/routes/payment.routes.ts`, pricing constants). If Enterprise price is fixed, add it to pricing config and allow checkout; if it requires custom pricing, define a minimal self-serve path (e.g. annual only, fixed price) or document the decision to keep "Contact sales" for true enterprise deals.
- **Database:** Ensure `subscriptions` (or equivalent) allows `tier = 'enterprise'` and that limits for enterprise are defined (e.g. in `TIER_LIMITS`).

---

## 11. Payment – Credit Card Selection 400 Error

**Goal:** Fix the "Request failed with status code 400" when the user selects "Debit or Credit Card" during upgrade.

**Scope:**
- **Frontend:** `frontend/components/subscription/subscription-manager.tsx` (or wherever the upgrade modal and payment method selection live) – The "Debit or Credit Card" path likely calls a different PayPal/client flow (e.g. create order with card). Inspect the request payload and endpoint when the user clicks "Debit or Credit Card".
- **Backend:** Payment route that handles PayPal/card – e.g. `backend/src/routes/payment.routes.ts` or PayPal webhook/capture. Ensure the backend accepts the payload sent when the client uses the card option (e.g. PayPal order creation with card intent). Common causes of 400: wrong endpoint, missing/invalid parameters (currency, amount, plan id), or validation errors. Log the request body and validation errors to identify the exact cause.
- **PayPal integration:** Ensure server-side order creation supports both "PayPal" and "Card" funding; fix parameter names or amounts (e.g. currency code, decimal format) to match what the API expects.
- **Testing:** Reproduce with "Debit or Credit Card", capture the 400 response and fix the corresponding backend validation or PayPal API call.

---

## 12. Overage Status After Payment – Clear "Has Overage" When Paid

**Goal:** After the user pays overage charges, the UI and status should no longer show "user has overage and has to pay".

**Scope:**
- **Backend:** When an overage payment is completed (e.g. PayPal webhook or success callback), ensure overage records for that period are **linked to the payment** (e.g. `OverageService.linkOverageToPayment`). When computing "has overage" or "overage due", **exclude** records that already have a `payment_id` set, or consider them "paid".
- **API that returns overage status:** The endpoint that the frontend uses to show "You have overage, pay now" (e.g. usage/overage summary) should consider `payment_id` on `overage_records`: only treat as "unpaid overage" when there are overage records for the current period with no `payment_id` (or status not paid). After payment, either set `payment_id` on those records or mark them paid so the same API returns "no unpaid overage".
- **Frontend:** `frontend/components/subscription/subscription-manager.tsx` and any usage/overage component – After a successful overage payment, refresh usage/overage data (and subscription) so the banner/status updates. If the backend correctly marks overage as paid, the frontend just needs to refetch; no need to show "has overage" when backend says there is no unpaid overage.
- **Summary:** Implement or fix: (1) backend links overage records to payment on success, (2) overage/usage API excludes or marks paid overage, (3) frontend refetches after payment success.

---

## 13. Invoice Branding – Samabrains Solutions

**Goal:** Brand generated invoices with company details: **Samabrains Solutions**, **Info@samabrains.com**, **Located in Kampala, Uganda**.

**Scope:**
- **Backend:** `backend/src/services/invoice.service.ts` – Replace or update the current issuer text (e.g. "QueryAI", "Subscription Service Provider", "support@queryai.com") with:
  - Company name: **Samabrains Solutions**
  - Email: **Info@samabrains.com**
  - Location: **Kampala, Uganda** (e.g. in the footer or under the company name).
- **PDF layout:** Ensure the PDF generated for invoices and receipts uses the above branding and, if applicable, any logo or address block for Samabrains Solutions.

---

## 14. Remove Tavily Branding from Frontend

**Goal:** Users should not see that Tavily is used; remove the name/branding "Tavily" from the frontend.

**Scope:**
- **Frontend:** Search for "Tavily" (and "tavily") in `frontend/` and replace user-facing strings with generic wording.
- **Known files:** `frontend/lib/api.ts` (e.g. usage labels), `frontend/components/subscription/subscription-manager.tsx` (e.g. "Tavily searches" in table and usage), `frontend/components/usage/usage-display.tsx` (e.g. "Tavily Searches" label and warnings).
- **Actions:** Replace labels like "Tavily searches" with e.g. "Web searches" or "Search usage". Replace any "Tavily" in tooltips, warnings, or upgrade messages. Do **not** change backend logic or API contract (e.g. `tavilySearches` in JSON can remain for internal consistency); only change user-visible text.
- **Backend:** No need to change logging or internal metric names for this task; focus on frontend copy only.

---

## 15. Admin / Super Admin – Role and Visibility

**Goal:** Allow specific user accounts to be set as **admin** or **super admin**, and show admin/super-admin-only items only to those accounts.

**Scope:**
- **Database:** Add a role (e.g. `role` or `admin_role`) to `user_profiles` or a dedicated table: e.g. `'user' | 'admin' | 'super_admin'`. Migration to add column and backfill default `'user'`.
- **Backend – Auth/session:** When returning the current user (e.g. `GET /api/auth/me` or login response), include `role` (or `isAdmin`, `isSuperAdmin`) from the profile. Middleware or route helpers can then restrict certain routes to `admin` or `super_admin`.
- **Backend – Routes:** Protect admin-only routes (e.g. A/B testing, validation, analytics, health) with a middleware that checks `role === 'admin' || role === 'super_admin'` (and optionally super_admin-only for a subset). Apply to existing admin routes.
- **Frontend – Sidebar/nav:** `frontend/components/sidebar/app-sidebar.tsx` – Currently admin visibility is based on e.g. `subscriptionTier === 'pro'` or email domain (`@admin`, `@internal`). Change to use the new `role` from the user object (e.g. `user.role === 'admin' || user.role === 'super_admin'`). Show "A/B Testing", "Validation Reports", and any other admin items only when the user has the appropriate role.
- **Admin UI to set role:** Add an admin-only page or internal tool to set a user's role to `admin` or `super_admin` (e.g. by user id or email). This could be a simple form in an existing admin area or a separate internal route. Do not expose this to normal users.

---

## 16. Mobile Responsiveness

**Goal:** Improve mobile responsiveness across all device sizes (small phones to tablets).

**Scope:**
- **Areas:** Dashboard layout, sidebar (drawer), chat thread, message bubbles, input, subscription/payment modals, settings pages, landing page, headers/footers.
- **Actions:**
  - Use existing `useMobile` (or similar) and mobile components (`MobileSidebar`, `BottomNavigation`, `HamburgerMenu`) consistently; ensure the main content and chat are usable when sidebar is closed.
  - Test chat interface: message width, font size, tap targets, source panel/collapsible sources on small screens.
  - Settings: ensure settings nav is usable (e.g. stacked or drawer on mobile) and forms are readable and tappable.
  - Subscription/payment: ensure modals and buttons are full-width or properly sized and not cut off on narrow viewports.
  - Landing page: ensure minimal layout (from item 1) is responsive (e.g. logo, CTA, one short block).
  - Fix overflow issues (horizontal scroll, clipped text) and ensure critical actions (send message, logout, upgrade) are accessible on small screens.
  - Use responsive Tailwind classes (`sm:`, `md:`, `lg:`) and test at breakpoints (e.g. 320px, 375px, 768px, 1024px).

---

## 17. Logout and User Block – Bottom Left; Plan and Upgrade Visible

**Goal:** Move logout to the **bottom-left** of the sidebar. Keep **user name**, **subscription plan**, and an **Upgrade** action button (when on a lower plan) always visible there.

**Scope:**
- **File:** `frontend/components/sidebar/app-sidebar.tsx` (and optionally the dashboard layout if header is changed).
- **Current:** Logout and user email are in the **top-right** of the main dashboard header (`frontend/app/dashboard/page.tsx`).
- **Actions:**
  - In the **sidebar**, add a bottom section (at the end of the vertical nav, above any mobile bottom nav) that shows:
    - User name (or email if no name)
    - Subscription plan (e.g. "Free" / "Starter" / "Premium" / "Pro" / "Enterprise")
    - **Upgrade** button – visible when the user is on a plan that can be upgraded (e.g. not Enterprise); link to Settings > Subscription or open upgrade modal.
    - **Logout** button (or link)
  - Remove or reduce the top-right header block that currently shows user email and Logout (e.g. keep only a minimal header with logo/title and maybe a settings icon; move user and logout entirely to sidebar bottom).
  - Ensure this block is visible in both expanded and collapsed sidebar (e.g. in collapsed mode show icons only or a tooltip with name/plan; logout icon always available).
  - Mobile: ensure the same info and logout are accessible from the mobile sidebar/drawer bottom.

---

## Implementation Order (Suggested)

1. **Backend profile (8)** – Add `PUT /api/auth/profile` to fix 404; unblocks profile/settings.
2. **Navigation and layout (2, 7, 9)** – Conversation opens thread; move Subscription/Documents/Topics under Settings; add back link from Settings.
3. **Sources and actions in chat (3, 4)** – Collapsible sources per message; ellipsis menu for actions.
4. **Follow-ups (5)** – Same RAG flow and formatting for suggested questions.
5. **Remove API Keys & Embeddings (6)** – Sidebar, dashboard, API, backend routes.
6. **Tavily branding (14)** – Frontend copy only.
7. **Invoice branding (13)** – Invoice service text.
8. **Payment and overage (11, 12)** – Fix card 400; fix overage status after payment.
9. **Enterprise self-enrollment (10)** – Self-serve enterprise option.
10. **Admin/super admin (15)** – Role field, backend checks, frontend visibility.
11. **User block and logout (17)** – Bottom-left sidebar block.
12. **Landing page (1)** – Minimal design and logo.
13. **Mobile (16)** – Full pass on responsiveness.

---

## Document Info

- **Created:** 2025-01-30  
- **Project:** QueryAI  
- **Status:** Plan only; implementation to be done per section.
