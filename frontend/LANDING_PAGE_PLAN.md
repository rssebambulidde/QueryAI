# Landing Page Plan – QueryAI

Plan for improving and expanding the public landing page (`/`) to better convert visitors and communicate value. **Implementation not included** – this is a planning document only.

---

## 1. Current State

- **Route:** `frontend/app/page.tsx`
- **Behavior:** Auth check → if authenticated, redirect to `/dashboard`; else show a minimal landing.
- **Content today:**
  - Header: Logo, Sign in, Get started
  - Hero: One headline, one subtext, one CTA (“Get started free”), one trust line (“Free tier · No credit card required”)
  - Footer: Logo, company line (SamaBrains Solutions · Kampala, Uganda), Privacy, Terms, Disclaimer
- **SEO:** FAQ JSON-LD schema (not rendered on page), root layout metadata (title, description, OG, etc.).

**Gaps:** No clear value proposition breakdown, no features/benefits, no social proof, no pricing hint, no use cases, no visible FAQ, no secondary CTAs, limited mobile-first narrative.

---

## 2. Goals

- **Primary:** Increase sign-ups (Sign up / Get started) from visitors who understand the product.
- **Secondary:** Improve SEO and shareability (OG, clarity of offering), support brand (SamaBrains, Kampala), and set expectations (sources, citations, free tier).

---

## 3. Proposed Structure (Sections)

| Order | Section           | Purpose |
|-------|-------------------|--------|
| 1     | **Header / Nav**   | Logo, primary nav (e.g. Features, Pricing, FAQ), Sign in, Get started. Sticky on scroll. |
| 2     | **Hero**          | Headline, subhead, primary CTA, optional secondary CTA (e.g. “See how it works”). Keep short and scannable. |
| 3     | **Social proof**   | Optional: logos, “Used by X researchers”, or a short testimonial. Light touch if no data yet. |
| 4     | **Features**       | 3–4 cards: e.g. “Ask in plain language”, “Answers with sources”, “Your documents + web”, “Citations you can verify”. Icon + title + 1–2 lines each. |
| 5     | **How it works**   | 3 steps: e.g. “Ask a question” → “We search your docs and the web” → “Get a cited answer”. Supports clarity and reduces friction. |
| 6     | **Use cases**      | 2–3 short use cases: e.g. “Research for papers”, “Fact-check quickly”, “Deep dives on topics”. One line each + optional illustration or icon. |
| 7     | **Pricing teaser** | One line: “Start free. Upgrade when you need more.” + link to “Pricing” or `/signup` (or `/dashboard` if pricing is in-app). No full pricing table on landing unless desired. |
| 8     | **FAQ**            | 4–6 questions (expand existing schema): What is QueryAI? Free tier? How are sources used? Data privacy? etc. Accordion or short list. Reuse/align with FAQ JSON-LD. |
| 9     | **Final CTA**     | Repeated “Get started free” (and “Sign in” if not in header) with same trust line (Free tier · No credit card). |
| 10    | **Footer**         | Logo, company, links: Privacy, Terms, Disclaimer, optional Contact or Pricing. Keep current structure; add links if new pages exist. |

Sections 4–8 can be reordered (e.g. How it works before Features) or merged (e.g. Features + How it works) depending on copy and design.

---

## 4. Content Guidelines

- **Tone:** Clear, professional, trustworthy. Emphasize “sources”, “citations”, “verify”, “research”.
- **Headline:** Keep or refine “Research with sources you can verify” so it stays benefit-led and differentiation-focused.
- **CTAs:** Primary = “Get started free” or “Start free”; secondary = “Sign in” or “See how it works”.
- **Trust:** “Free tier · No credit card required” and, if applicable, one line on data/privacy (e.g. “Your data stays yours”).
- **Local:** Retain “SamaBrains Solutions · Kampala, Uganda” in footer (and anywhere else it appears).

---

## 5. Design and UX

- **Layout:** Single column, full width; max-width container for text (e.g. 1024px) for readability.
- **Spacing:** Clear section spacing (e.g. py-12–16 per section) so the page doesn’t feel cramped.
- **Mobile:** Stack all sections vertically; sticky header with hamburger if nav grows; touch-friendly CTAs (min height 44px); no horizontal scroll.
- **Performance:** Prefer CSS and existing components; limit heavy images or animations; lazy-load below-the-fold images if any.
- **Brand:** Reuse existing palette (e.g. orange accent, white/gray backgrounds) and Logo component for consistency with app.

---

## 6. Technical Notes

- **Auth:** Keep current behavior: if authenticated, redirect to `/dashboard`; otherwise show landing. No change to auth flow.
- **OAuth hash:** Keep redirect from `/?...#access_token` to `/auth/callback` so OAuth continues to work.
- **Routing:** All new content stays on `/` (single landing). Optional: `/pricing` or `/features` later if you want dedicated pages.
- **SEO:** Keep root metadata; add or expand FAQ JSON-LD to match the new FAQ section; ensure one H1 (hero headline); use semantic HTML (header, main, section, footer).
- **Analytics:** Plan for CTA click and scroll depth (no implementation in this plan).

---

## 7. Phasing (Suggested)

| Phase | Scope |
|-------|--------|
| **1 – Minimal** | Hero + Features (3–4 cards) + existing footer; optional “How it works” (3 steps). No new routes. |
| **2 – Expand** | Add FAQ (visible section + schema), Use cases, Pricing teaser, Final CTA. |
| **3 – Polish** | Social proof (if available), small design/UX tweaks, performance pass, analytics hooks. |

You can stop after Phase 1 and still have a much stronger landing than today.

---

## 8. Out of Scope (For This Plan)

- New auth flows or signup UX changes.
- Blog or content hub.
- A/B testing setup.
- Multi-language landing.
- Full pricing page (only a teaser line is in scope).

---

## 9. Success Criteria (Optional)

- Fewer bounces and longer time on page (if tracked).
- Higher click-through on “Get started” / “Sign up” from `/`.
- Improved relevance in search for terms like “fact research assistant”, “source-cited answers”, “QueryAI”.

---

## 10. File / Component Hints (When Implementing)

- **Page:** `frontend/app/page.tsx` – keep auth and OAuth logic; replace or wrap current hero/footer in new sections.
- **Components:** Consider `frontend/components/landing/` for reusable blocks (e.g. `Hero.tsx`, `Features.tsx`, `HowItWorks.tsx`, `FAQ.tsx`, `Footer.tsx`) so the main page stays readable.
- **Styles:** Use Tailwind and existing design tokens; avoid one-off inline styles where possible.
- **Assets:** If needed, add images or icons under `frontend/public/` or use existing icon set (e.g. Lucide).

---

*Document created as a plan only. No code changes are made in this step.*
