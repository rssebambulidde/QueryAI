# External Service Cost Analysis & Profitability Model

## Executive Summary

This document provides a detailed analysis of external service costs that power the QueryAI application, calculates cost per user, and proposes a pricing model that ensures profitability while remaining competitive.

**Critical Finding:** Current pricing structure is **NOT PROFITABLE** due to high Tavily Search API costs.

---

## 1. External Service Cost Breakdown

### 1.1 OpenAI API Costs

#### Pricing Structure
- **GPT-4 Turbo:** $0.01 per 1K input tokens, $0.03 per 1K output tokens
- **GPT-3.5 Turbo:** $0.0005 per 1K input tokens, $0.0015 per 1K output tokens
- **Embeddings (text-embedding-3-small):** $0.02 per 1M tokens

#### Average Query Cost
**Assumptions:**
- Average query: 500 input tokens, 1000 output tokens
- GPT-4 Turbo: $0.005 + $0.03 = **$0.035 per query**
- GPT-3.5 Turbo: $0.00025 + $0.0015 = **$0.00175 per query**
- Embedding generation: $0.0001 per query (1000 tokens)

**Recommended Usage:**
- Free/Premium tiers: GPT-3.5 Turbo ($0.00175/query)
- Pro tier: GPT-4 Turbo ($0.035/query)
- All tiers: Embeddings ($0.0001/query)

#### Monthly Cost Per User
| Tier | Queries | Model | Cost per Query | Monthly Cost |
|------|---------|-------|----------------|--------------|
| Free | 50 | GPT-3.5 | $0.00185 | **$0.09** |
| Premium | 500 | GPT-3.5 | $0.00185 | **$0.93** |
| Pro | 2000 | GPT-4 | $0.0351 | **$70.20** |

**Note:** Pro tier costs are high with GPT-4. Consider using GPT-3.5 for most queries, GPT-4 for complex ones.

---

### 1.2 Tavily Search API Costs

#### Pricing Structure
- **Free Tier:** 1,000 searches/month
- **Pro Plan:** $99/month for 10,000 searches ($0.0099 per search)
- **Enterprise:** Custom pricing

**Current Usage:** Assuming Pro plan pricing
- Cost per search: **$0.10-0.20** (depending on plan)

#### Monthly Cost Per User
| Tier | Searches | Cost per Search | Monthly Cost |
|------|----------|-----------------|--------------|
| Free | 0 | $0 | **$0** |
| Premium | 50 | $0.10 | **$5.00** |
| Pro | 200 | $0.10 | **$20.00** |

**⚠️ CRITICAL:** Tavily costs are significant. Must implement limits and caching.

---

### 1.3 Pinecone Vector Database Costs

#### Pricing Structure
- **Free Tier:** 1 index, 100K vectors, 1 pod
- **Starter:** $70/month (1M vectors, 1 pod)
- **Standard:** $70/month + $0.096 per 100K vectors

#### Cost Calculation
**Assumptions:**
- Average user: 10 documents, 100 chunks per document = 1,000 vectors
- 1,000 users = 1M vectors
- Cost: $70/month base + $0.96 per 100K vectors = **$0.70 per user/month**

#### Monthly Cost Per User
| Tier | Vectors | Monthly Cost |
|------|---------|--------------|
| Free | 0 | **$0** |
| Premium | 1,000 | **$0.07** |
| Pro | 5,000 | **$0.35** |

---

### 1.4 Supabase Costs

#### Pricing Structure
- **Free Tier:** 500MB database, 1GB storage, 2GB bandwidth
- **Pro:** $25/month (8GB database, 100GB storage, 250GB bandwidth)

#### Cost Calculation
**Assumptions:**
- Average user: 5MB database, 10MB storage
- 1,000 users = 5GB database, 10GB storage
- Pro plan: $25/month for 1,000 users = **$0.025 per user/month**

#### Monthly Cost Per User
| Tier | Database | Storage | Monthly Cost |
|------|----------|---------|--------------|
| Free | 5MB | 10MB | **$0.03** |
| Premium | 10MB | 50MB | **$0.05** |
| Pro | 20MB | 200MB | **$0.10** |

---

### 1.5 Other Service Costs

#### Brevo (Email Service)
- **Free Tier:** 300 emails/day
- **Lite:** $25/month (10,000 emails/month)
- **Cost per user:** $0.01/month (assuming 1 email/user/month)

#### Railway (Backend Hosting)
- **Pay-as-you-go:** ~$0.000463 per GB-hour
- **Average:** $10-20/month for backend
- **Cost per user:** $0.01/month (assuming 1,000 users)

#### Cloudflare Pages (Frontend)
- **Free Tier:** Unlimited
- **Cost per user:** $0

---

## 2. Total Cost Per User Analysis

### 2.1 Current Pricing vs Costs

| Tier | Revenue | OpenAI | Tavily | Pinecone | Supabase | Other | **Total Cost** | **Profit/Loss** | **Margin** |
|------|---------|--------|--------|----------|----------|-------|----------------|-----------------|-----------|
| Free | $0 | $0.09 | $0 | $0 | $0.03 | $0.02 | **$0.14** | **-$0.14** | N/A |
| Premium | $15 | $0.93 | $5.00 | $0.07 | $0.05 | $0.03 | **$6.08** | **+$8.92** | **59%** |
| Pro | $45 | $70.20 | $20.00 | $0.35 | $0.10 | $0.05 | **$90.70** | **-$45.70** | **-102%** |

**⚠️ CRITICAL FINDING:**
- Free tier: Loses $0.14 per user/month
- Premium tier: **Profitable** with 59% margin
- Pro tier: **Loses $45.70 per user/month** (not sustainable!)

### 2.2 Revised Cost Model (With Optimizations)

**Optimizations Applied:**
1. Use GPT-3.5 for Pro tier (most queries)
2. Limit Tavily searches per tier
3. Implement caching (50% reduction)
4. Optimize Pinecone usage

| Tier | Revenue | OpenAI | Tavily | Pinecone | Supabase | Other | **Total Cost** | **Profit** | **Margin** |
|------|---------|--------|--------|----------|----------|-------|----------------|------------|-------------|
| Free | $0 | $0.09 | $0 | $0 | $0.03 | $0.02 | **$0.14** | **-$0.14** | N/A |
| Premium | $15 | $0.93 | $2.50 | $0.07 | $0.05 | $0.03 | **$3.58** | **+$11.42** | **76%** |
| Pro | $45 | $14.04 | $10.00 | $0.35 | $0.10 | $0.05 | **$24.54** | **+$20.46** | **45%** |

**Result:** All paid tiers are profitable with optimizations.

---

## 3. Recommended Pricing Structure

### 3.1 Revised Pricing Tiers

| Tier | Monthly | Annual | Queries | Tavily | Documents | Topics | API Calls | Profit Margin |
|------|---------|--------|---------|--------|-----------|--------|-----------|----------------|
| **Free** | $0 | - | 20 | 0 | 0 | 0 | 0 | Break-even |
| **Starter** | $9 | $90 | 100 | 10 | 3 | 1 | 0 | 70% |
| **Premium** | $19 | $190 | 500 | 50 | 10 | 3 | 0 | 76% |
| **Pro** | $59 | $590 | Unlimited | 200 | Unlimited | Unlimited | 1,000 | 65% |

### 3.2 Overage Pricing

**Additional Usage:**
- Queries: $0.10 per query (after limit)
- Tavily searches: $0.20 per search (after limit)
- Documents: $0.50 per document/month (after limit)
- API calls: $0.01 per call (after limit)

### 3.3 Cost Allocation Per Tier

**Free Tier:**
- Cost: $0.14/user/month
- Revenue: $0
- Strategy: Break-even, use as acquisition channel

**Starter Tier:**
- Cost: $2.70/user/month
- Revenue: $9
- Profit: $6.30 (70% margin)

**Premium Tier:**
- Cost: $3.58/user/month
- Revenue: $19
- Profit: $15.42 (81% margin)

**Pro Tier:**
- Cost: $20.65/user/month
- Revenue: $59
- Profit: $38.35 (65% margin)

---

## 4. Cost Optimization Strategies

### 4.1 Immediate Actions (Week 1)

1. **Implement Tavily Limits**
   - Free: 0 searches
   - Starter: 10 searches/month
   - Premium: 50 searches/month
   - Pro: 200 searches/month

2. **Add Caching Layer**
   - Cache Tavily results for 24 hours
   - Cache LLM responses for similar queries
   - Expected reduction: 50-70% of API calls

3. **Optimize LLM Usage**
   - Use GPT-3.5 for Free/Premium tiers
   - Use GPT-3.5 for 80% of Pro tier queries
   - Use GPT-4 only for complex queries

4. **Query Optimization**
   - Deduplicate similar queries
   - Batch multiple queries
   - Implement query rate limiting

### 4.2 Medium-Term Actions (Weeks 2-4)

1. **Alternative Search Providers**
   - Research Google Custom Search API
   - Research SerpAPI
   - Research Bing Search API
   - Implement provider abstraction

2. **Advanced Caching**
   - Redis caching for frequent queries
   - CDN caching for static responses
   - Database query caching

3. **Cost Monitoring**
   - Real-time cost tracking
   - Per-user cost alerts
   - Automated tier upgrades for high-usage users

### 4.3 Long-Term Actions (Months 2-3)

1. **Self-Hosted Solutions**
   - Consider self-hosting embeddings
   - Consider self-hosting search (Elasticsearch)
   - Evaluate cost savings vs maintenance

2. **Bulk Discounts**
   - Negotiate better rates with providers
   - Commit to higher usage volumes
   - Consider enterprise agreements

---

## 5. Cost Monitoring & Alerts

### 5.1 Key Metrics to Track

1. **Cost Per User (CPU)**
   - Track daily, weekly, monthly
   - Alert if CPU > 80% of revenue

2. **Cost Per Query (CPQ)**
   - Track average CPQ per tier
   - Alert if CPQ increases >20%

3. **Service-Specific Costs**
   - OpenAI costs
   - Tavily costs
   - Pinecone costs
   - Supabase costs

4. **Profitability Metrics**
   - Gross margin per tier
   - Overall profitability
   - Break-even user count

### 5.2 Alert Thresholds

**Critical Alerts:**
- CPU > 100% of revenue (losing money)
- Tavily costs > $50/user/month
- OpenAI costs > $30/user/month
- Overall margin < 20%

**Warning Alerts:**
- CPU > 80% of revenue
- Service costs increase >20%
- Cache hit rate < 50%

### 5.3 Cost Dashboard

**Implement:**
- Real-time cost dashboard
- Per-user cost breakdown
- Service cost breakdown
- Profitability charts
- Cost trends over time

---

## 6. Break-Even Analysis

### 6.1 Fixed Costs

**Monthly Fixed Costs:**
- Railway hosting: $20/month
- Supabase Pro: $25/month
- Brevo Lite: $25/month
- Monitoring tools: $10/month
- **Total: $80/month**

### 6.2 Variable Costs Per User

| Tier | Variable Cost | Fixed Cost Share | Total Cost |
|------|---------------|------------------|------------|
| Free | $0.14 | $0.08 | $0.22 |
| Starter | $2.70 | $0.08 | $2.78 |
| Premium | $3.58 | $0.08 | $3.66 |
| Pro | $20.65 | $0.08 | $20.73 |

### 6.3 Break-Even User Count

**Assumptions:**
- 10% Free users
- 60% Starter users
- 25% Premium users
- 5% Pro users

**Average Revenue Per User (ARPU):**
- (0.1 × $0) + (0.6 × $9) + (0.25 × $19) + (0.05 × $59) = **$12.30**

**Average Cost Per User (ACPU):**
- (0.1 × $0.22) + (0.6 × $2.78) + (0.25 × $3.66) + (0.05 × $20.73) = **$3.88**

**Break-Even:**
- Fixed costs: $80/month
- Profit per user: $12.30 - $3.88 = $8.42
- Break-even users: $80 / $8.42 = **~10 users**

**Conclusion:** Break-even at ~10 paying users (excluding free users).

---

## 7. Recommendations

### 7.1 Immediate Actions

1. ✅ **Implement Tavily limits** (Week 1)
2. ✅ **Add caching layer** (Week 1)
3. ✅ **Update pricing tiers** (Week 2)
4. ✅ **Implement cost tracking** (Week 2)

### 7.2 Pricing Adjustments

1. **Increase Pro tier price** to $59/month (from $45)
2. **Add Starter tier** at $9/month
3. **Implement overage pricing** for additional usage
4. **Add annual billing** with 15-20% discount

### 7.3 Cost Optimization

1. **Use GPT-3.5** for most queries (save 95% on LLM costs)
2. **Limit Tavily searches** per tier
3. **Implement aggressive caching** (target 60%+ hit rate)
4. **Research alternative search providers**

### 7.4 Monitoring

1. **Implement cost dashboard**
2. **Set up alerts** for cost overruns
3. **Track profitability** per tier
4. **Monitor per-user costs** daily

---

## 8. Conclusion

### 8.1 Key Findings

1. **Current Pro tier pricing is unsustainable** - loses $45.70/user/month
2. **Tavily costs are the primary cost driver** - must be limited
3. **With optimizations, all tiers can be profitable**
4. **Break-even is achievable** at ~10 paying users

### 8.2 Action Plan

1. **Week 1:** Implement cost controls and limits
2. **Week 2:** Update pricing and add Starter tier
3. **Week 3-4:** Implement cost monitoring
4. **Ongoing:** Optimize costs and adjust pricing

### 8.3 Success Criteria

- All paid tiers profitable (>50% margin)
- Cost per user < 50% of revenue
- Cache hit rate > 60%
- Break-even at < 20 paying users

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Next Review:** Weekly during implementation, monthly thereafter
