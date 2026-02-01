# Cost & Profit Projection — 30 Pro Users per Month

This document projects **external service costs** and **profit** for QueryAI when you have an **average of 30 users per month on the Pro plan**. It also explains **how to monitor** those costs over time.

**Current Pro plan price (reference):** $45/month USD (150,000 UGX).

---

## Quick reference (30 Pro users, ~$45/user/month)

**Scenario A — Free tiers where providers offer them (recommended baseline):**

| Metric | Amount (USD) |
|--------|--------------|
| **Revenue** | $1,350/month |
| **Variable cost (30 × $14.04, OpenAI only; rest on free tiers)** | $421 |
| **Fixed cost (platform)** | $0 (free tiers) |
| **Redis** | $0 (free tier) |
| **PayPal (estimated)** | ~$62 |
| **Total cost** | **~$483/month** |
| **Profit (before tax)** | **~$867/month** |
| **Margin** | ~64% |

**Scenario B — Paid plans (if you exceed free-tier limits):**

| Metric | Amount (USD) |
|--------|--------------|
| **Revenue** | $1,350/month |
| **Variable cost (30 × $24.54)** | $736 |
| **Fixed cost (platform)** | $80 |
| **Redis** | $0 (free tier) or add if paid |
| **PayPal (estimated)** | ~$62 |
| **Total cost** | ~$878/month |
| **Profit (before tax)** | ~$472/month |
| **Margin** | ~35% |

**How to monitor:** Use **Super Admin → Cost Analytics** in the app for LLM cost; check each provider’s billing dashboard monthly (OpenAI, Tavily, Pinecone, Supabase, Brevo, **Redis**, Railway, PayPal). See Section 5 for the full checklist.

---

## 1. Assumptions

| Item | Value |
|------|--------|
| Users (Pro plan) | 30 per month (average) |
| Pro price (monthly) | $45 USD |
| Billing | Monthly (subscription) |
| Usage model | Optimized: GPT-3.5 for most queries, GPT-4 for complex; Tavily limits and caching applied |
| **Free tiers** | Where a provider offers free usage, we assume you stay within that free tier (see Section 2.1). |

All monetary figures below are in **USD** unless noted.

---

## 2. External Services That Support the App

QueryAI relies on these external services. Costs are incurred per use (API calls, storage, bandwidth) or as fixed monthly fees.

| Service | Role in QueryAI | How you're charged |
|---------|------------------|----------------------|
| **OpenAI** | LLM (GPT) and embeddings | Per token (input/output); embeddings per token |
| **Tavily** | Web search for answers | Per search (plan or usage-based) |
| **Pinecone** | Vector DB for document search | Per index/pod and vector count |
| **Supabase** | Auth, DB, storage | Plan (e.g. Pro) or usage over free tier |
| **Redis** | Caching (search, LLM, embeddings) — `RedisCacheService` | Hosted Redis: free tier or per memory/connection |
| **Brevo** | Transactional email | Per email or plan |
| **Railway** (or host) | Backend hosting | Per compute/storage (e.g. $/GB-hour) |
| **PayPal** | Subscriptions & payments | % + fixed fee per transaction |
| **Frontend host** (e.g. Vercel/Cloudflare) | App frontend | Often free tier; paid if over limits |

### 2.1 Free tiers (where offered)

When a provider offers a free tier, the **Scenario A** numbers assume you stay within these limits. If you exceed them, use **Scenario B** or add the paid cost.

| Service | Free tier (typical) | Limit / note |
|---------|----------------------|---------------|
| **OpenAI** | No free tier for API at scale | Usage-based only; variable cost applies. |
| **Tavily** | 1,000 searches/month | Stay under 1K total (e.g. ~33/user for 30 users) → $0. Over: e.g. Pro $99/mo for 10K. |
| **Pinecone** | 1 index, 100K vectors, 1 pod | 30 users × ~3K vectors ≈ 90K → fits free → $0. Over: paid plan. |
| **Supabase** | 500MB DB, 1GB storage, 2GB bandwidth | 30 users often fits → $0. Over: Pro $25/mo. |
| **Redis** (Upstash / Redis Cloud) | e.g. 10K commands/day, 256MB (Upstash) or 30MB (Redis Cloud) | Caching for 30 users can fit → **$0**. Over: paid tier. |
| **Brevo** | 300 emails/day | 30 users well under → **$0**. |
| **Railway** | Free trial / hobby limits | If within trial or hobby → $0. Production scale often paid (~$20/mo). |
| **Vercel / Cloudflare Pages** | Generous free tier | Frontend usually $0. |
| **PayPal** | No free tier | Fees apply (~3.49% + $0.49 per transaction). |

**Redis** is used in the app for caching (search results, LLM responses, embeddings). Using a hosted Redis with a **free tier** (e.g. Upstash, Redis Cloud) keeps Redis cost at **$0** as long as you stay within the free limits above.

---

## 3. Cost Projection per Month (30 Pro Users)

### 3.1 Scenario A — Free tiers where offered

Assumption: You stay within each provider’s free tier (Tavily ≤1K searches, Pinecone ≤100K vectors, Supabase/Brevo/Redis/Railway on free plans). **Redis** is included and assumed on a free tier (e.g. Upstash or Redis Cloud).

**Per-user variable cost (Pro, optimized; free tiers):**

| Cost component | Per Pro user/month |
|----------------|--------------------|
| OpenAI (LLM + embeddings) | $14.04 |
| Tavily (within 1K total/mo) | $0 |
| Pinecone (within 100K vectors) | $0 |
| Supabase (free tier) | $0 |
| Redis (free tier, caching) | $0 |
| Other (Brevo free, hosting share $0) | $0 |
| **Variable cost per Pro user** | **$14.04** |

**Fixed costs (platform; free tiers):**

| Item | Monthly |
|------|---------|
| Railway (free trial / hobby) | $0 |
| Supabase (free tier) | $0 |
| Brevo (free tier) | $0 |
| Redis (free tier, e.g. Upstash/Redis Cloud) | $0 |
| Monitoring / tools (free or none) | $0 |
| **Total fixed** | **$0** |

**Scenario A totals:**

| Component | Amount |
|-----------|--------|
| Variable (30 × $14.04) | $421.20 |
| Fixed (platform) | $0.00 |
| PayPal (estimated) | $62.00 |
| **Total cost** | **$483.20** |

### 3.2 Scenario B — Paid plans (when free limits are exceeded)

Use this when you exceed free-tier limits (e.g. Tavily >1K searches, Pinecone >100K vectors, Supabase/Railway on paid plans). **Redis** still assumed on free tier ($0); add a line if you use a paid Redis plan.

**Per-user variable cost (Pro, optimized; paid where needed):**

| Cost component | Per Pro user/month |
|----------------|--------------------|
| OpenAI (LLM + embeddings) | $14.04 |
| Tavily (web search, paid plan) | $10.00 |
| Pinecone (vectors) | $0.35 |
| Supabase (DB + storage share) | $0.10 |
| Redis (free tier) | $0 |
| Other (email, hosting share) | $0.05 |
| **Variable cost per Pro user** | **$24.54** |

**Fixed costs (platform; paid plans):**

| Item | Monthly |
|------|---------|
| Railway (backend) | $20 |
| Supabase (Pro plan base) | $25 |
| Brevo (email plan) | $25 |
| Redis (free tier) | $0 |
| Monitoring / tools | $10 |
| **Total fixed** | **$80** |

**Scenario B totals:**

| Component | Amount |
|-----------|--------|
| Variable (30 × $24.54) | $736.20 |
| Fixed (platform) | $80.00 |
| PayPal (estimated) | $62.00 |
| **Total cost** | **$878.20** |

### 3.3 Payment processing (PayPal)

PayPal has no free tier; fees apply regardless of scenario:

| Calculation | Amount |
|-------------|--------|
| 30 × (0.0349 × 45 + 0.49) | **~$62** |

---

## 4. Revenue and Profit Projection

**Revenue (same for both scenarios):** 30 × $45 = **$1,350/month**.

| Item | Scenario A (free tiers) | Scenario B (paid where needed) |
|------|-------------------------|--------------------------------|
| **Total cost** | $483.20 | $878.20 |
| **Profit (before tax)** | **$866.80** | **$471.80** |
| **Margin** | **~64%** | **~35%** |

Summary:

- **Revenue (30 Pro users):** $1,350/month in both cases.  
- **Scenario A (free tiers):** Total cost ~$483 (OpenAI + PayPal only; Redis, Tavily, Pinecone, Supabase, Brevo, Railway on free tiers). **Profit ~$867/month**, ~64% margin.  
- **Scenario B (paid where exceeded):** Total cost ~$878. **Profit ~$472/month**, ~35% margin.  

If you add more Pro users (with similar usage), profit scales with (Revenue − Variable cost per user × new users), minus fixed and PayPal. **Redis** remains $0 on free tier until you exceed the provider’s free limits (e.g. commands/day or memory).

---

## 5. How to Always Monitor External Service Costs

Monitoring has two parts: (1) **inside QueryAI** (cost analytics and usage) and (2) **at each provider** (invoices and usage).

### 5.1 Inside QueryAI (Super Admin)

- **Where:** Dashboard → **Settings** → **Super Admin** → **Cost Analytics** (Super Admin only).
- **What it does:** Uses `CostTrackingService` and usage logs to show:
  - Total cost over a date range
  - Cost trends over time (e.g. daily)
  - Breakdown by model (LLM cost)
- **What it covers:** Primarily **OpenAI (LLM)** cost derived from token usage. It does **not** include Tavily, Pinecone, Supabase, **Redis**, or PayPal; those must be checked at the provider.

**Action:** Check Cost Analytics at least **weekly** (e.g. every Monday). Set a mental or calendar reminder.

### 5.2 Provider dashboards and billing

Monitor each provider monthly (align with their billing cycle):

| Service | Where to check | What to look at |
|---------|----------------|------------------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com) → Usage / Billing | Usage by model (GPT, embeddings), current month spend, limits |
| **Tavily** | Tavily dashboard / account | Searches used vs plan (free 1K/mo or paid), overage |
| **Pinecone** | Pinecone console | Index size (vectors), pod type, monthly bill; free tier 100K vectors |
| **Supabase** | Supabase dashboard → Billing | DB size, storage, bandwidth, plan and overage |
| **Redis** (Upstash / Redis Cloud) | Provider dashboard → Usage / Billing | Commands/day, memory; free tier limits |
| **Brevo** | Brevo dashboard | Emails sent, plan limits |
| **Railway** | Railway dashboard → Billing | Compute and storage usage, monthly total |
| **PayPal** | PayPal Business → Reports / Activity | Subscription fees collected and PayPal fees (per transaction and monthly) |
| **Frontend host** | Vercel/Cloudflare dashboard | Bandwidth and build usage if on paid plan |

**Action:** Once per month (e.g. first week after month close), open each dashboard and record:
- Current month spend (or last month’s invoice)
- Usage vs limits (to avoid surprises and overages)

### 5.3 Simple cost-tracking checklist (monthly)

Use this as a recurring checklist (e.g. in a doc or spreadsheet):

1. **QueryAI Cost Analytics**  
   - [ ] Open Super Admin → Cost Analytics  
   - [ ] Note LLM cost for last 30 days  
   - [ ] Compare to previous month; if >20% increase, check usage (e.g. more queries or GPT-4 use)

2. **OpenAI**  
   - [ ] Check Usage/Billing for current month  
   - [ ] Note total spend and breakdown by product (API vs embeddings)

3. **Tavily**  
   - [ ] Check searches used vs plan limit  
   - [ ] Note any overage or plan upgrade need

4. **Pinecone**  
   - [ ] Check index size and pod  
   - [ ] Note monthly cost (free tier 100K vectors or paid)

5. **Redis** (Upstash / Redis Cloud / other)  
   - [ ] Check usage (commands/day, memory) vs free tier  
   - [ ] Note monthly cost (free tier or paid)

6. **Supabase**  
   - [ ] Check Billing for DB, storage, bandwidth  
   - [ ] Note total and any overage

7. **Brevo**  
   - [ ] Check emails sent vs plan  
   - [ ] Note if approaching limit

8. **Railway**  
   - [ ] Check Billing for the month  
   - [ ] Note total

9. **PayPal**  
   - [ ] Check fees for subscription payments in the period  
   - [ ] Reconcile with revenue (e.g. 30 × $45) and update your profit sheet

10. **Totals**  
   - [ ] Sum all provider costs + fixed + PayPal  
   - [ ] Compare to revenue (e.g. 30 × $45)  
   - [ ] Update your profit projection (e.g. this document or a spreadsheet)

### 5.4 Alerts and safeguards

- **OpenAI:** Set a monthly budget and usage alerts in the OpenAI dashboard to avoid runaway LLM cost.  
- **Tavily:** If you have a hard cap, set a reminder when you reach 70–80% of the monthly search limit.  
- **Supabase / Railway:** Enable billing alerts if the provider supports them (e.g. when spend exceeds $X).  
- **Redis:** If on a free tier, set a reminder when usage reaches ~80% of the free limit (e.g. commands/day or memory).  
- **Internal:** If you keep a spreadsheet, add a simple check: e.g. alert if (Total cost / Revenue) > 0.75 (i.e. margin below 25%).

### 5.5 Where monitoring is documented in the repo

- **Cost tracking (backend):** `backend/src/services/cost-tracking.service.ts` — calculates LLM cost per query; used by analytics.  
- **Cost analytics (backend):** `backend/src/services/cost-analytics.service.ts` — aggregates cost over time and by model.  
- **Cost Analytics UI:** `frontend/components/analytics/cost-dashboard.tsx` and Super Admin → Cost Analytics.  
- **Existing cost and optimization notes:** `EXTERNAL_SERVICE_COST_ANALYSIS.md` — detailed cost breakdown and optimization strategies.

---

## 6. Updating this projection

- **When to update:** When Pro price, usage assumptions, or provider pricing change.  
- **What to update:**  
  - Section 3: Per-user cost and/or fixed costs if you have new numbers.  
  - Section 4: Revenue and profit (e.g. if user count or price changes).  
  - Section 5: Links or product names if a provider changes its dashboard.

Keeping this document and a monthly checklist ensures you can **always monitor external service cost** and compare it to revenue and profit.

---

**Document version:** 1.1  
**Last updated:** February 2025  
**Assumptions:** 30 Pro users, $45/month Pro price, optimized usage (GPT-3.5 majority, Tavily limits, caching). **Redis** included; **free tiers** used where offered (Tavily ≤1K, Pinecone ≤100K vectors, Supabase/Brevo/Redis/Railway free).  
**Next review:** When Pro price, user count, or provider pricing changes.
