# Tavily Search Limits - Testing Guide

This guide provides comprehensive testing scenarios for the Tavily search limits implementation.

## Test Scenarios

### 1. Backend API Tests

#### 1.1 Subscription Service Tests

**Test: Free Tier Limit (5 searches)**
```bash
# 1. Create a free tier user
# 2. Make 5 Tavily searches (should succeed)
# 3. Make 6th search (should fail with limit exceeded)
```

**Test: Premium Tier Limit (50 searches)**
```bash
# 1. Create/upgrade to premium tier
# 2. Verify limit is 50
# 3. Make searches up to limit
```

**Test: Pro Tier Limit (200 searches)**
```bash
# 1. Create/upgrade to pro tier
# 2. Verify limit is 200
# 3. Make searches up to limit
```

#### 1.2 Usage Tracking Tests

**Test: Usage Count Accuracy**
```bash
# 1. Make a query with enableWebSearch=true
# 2. Check usage count via GET /api/usage/current
# 3. Verify tavilySearches.used increments correctly
```

**Test: Monthly Reset**
```bash
# 1. Use all Tavily searches in current month
# 2. Wait for new month (or manually adjust period)
# 3. Verify count resets to 0
```

#### 1.3 RAG Service Integration Tests

**Test: Limit Enforcement Before Search**
```bash
# 1. Set user to free tier with 5/5 searches used
# 2. Make a query with enableWebSearch=true
# 3. Verify:
#    - No Tavily API call is made
#    - Empty web results returned
#    - Document search still works
#    - No error thrown (graceful degradation)
```

**Test: Usage Increment After Successful Search**
```bash
# 1. Make a query with enableWebSearch=true
# 2. Verify usage count increments
# 3. Check metadata contains usedTavily: true
```

### 2. Frontend Tests

#### 2.1 Usage Display Tests

**Test: Tavily Usage Display**
```bash
# 1. Navigate to /dashboard?tab=subscription
# 2. Verify "Tavily Searches" section appears
# 3. Check progress bar shows correct usage
# 4. Verify limit and remaining counts are correct
```

**Test: Warning Display**
```bash
# 1. Use 80%+ of Tavily searches
# 2. Verify warning appears in usage display
# 3. Check warning message is appropriate
```

**Test: Limit Reached Display**
```bash
# 1. Use all Tavily searches
# 2. Verify:
#    - Progress bar shows 100%
#    - Red warning appears
#    - "Upgrade Now" button is visible
```

#### 2.2 Subscription Manager Tests

**Test: Tavily Usage in Subscription Manager**
```bash
# 1. Navigate to subscription page
# 2. Verify Tavily searches are shown in usage section
# 3. Check fallback display works if UsageDisplay component fails
```

### 3. Integration Tests

#### 3.1 End-to-End Flow

**Test: Complete Query Flow with Limit**
```bash
# Setup:
# - Free tier user with 4/5 searches used

# Steps:
# 1. Make query with enableWebSearch=true
#    - Should succeed (5th search)
#    - Usage should increment to 5/5
# 2. Make another query with enableWebSearch=true
#    - Should still work but return empty web results
#    - Usage should NOT increment (limit exceeded)
#    - Document search should still work
```

**Test: Upgrade Flow**
```bash
# 1. Free tier user hits limit
# 2. Click "Upgrade Now" button
# 3. Complete upgrade to premium
# 4. Verify limit increases to 50
# 5. Verify usage resets appropriately
```

### 4. API Endpoint Tests

#### 4.1 GET /api/subscription

**Test: Tavily Usage in Response**
```bash
curl -X GET http://localhost:3001/api/subscription \
  -H "Authorization: Bearer <token>"

# Verify response includes:
# {
#   "usage": {
#     "tavilySearches": {
#       "allowed": true,
#       "used": 3,
#       "limit": 5,
#       "remaining": 2
#     }
#   }
# }
```

#### 4.2 GET /api/usage/current

**Test: Tavily Usage Stats**
```bash
curl -X GET http://localhost:3001/api/usage/current \
  -H "Authorization: Bearer <token>"

# Verify response includes:
# {
#   "usage": {
#     "tavilySearches": {
#       "used": 3,
#       "limit": 5,
#       "remaining": 2,
#       "percentage": 60
#     }
#   }
# }
```

#### 4.3 GET /api/usage/warnings

**Test: Tavily Warning**
```bash
# Use 80%+ of Tavily searches, then:
curl -X GET http://localhost:3001/api/usage/warnings \
  -H "Authorization: Bearer <token>"

# Verify response includes:
# {
#   "warnings": [
#     {
#       "type": "tavilySearches",
#       "percentage": 85
#     }
#   ]
# }
```

### 5. Edge Cases

#### 5.1 Boundary Conditions

**Test: Exactly at Limit**
```bash
# 1. Use exactly 5/5 searches (free tier)
# 2. Make another query
# 3. Verify limit is enforced
```

**Test: Just Under Limit**
```bash
# 1. Use 4/5 searches (free tier)
# 2. Make another query
# 3. Verify it succeeds
```

#### 5.2 Error Handling

**Test: Database Error Handling**
```bash
# 1. Simulate database error in getTavilyUsageCount
# 2. Verify service returns safe default (0)
# 3. Verify limit check still works
```

**Test: Missing Subscription**
```bash
# 1. User with no subscription
# 2. Verify default free tier limits apply
```

### 6. Performance Tests

**Test: Usage Count Query Performance**
```bash
# 1. User with many usage logs
# 2. Measure time to get Tavily usage count
# 3. Verify it's acceptable (< 100ms)
```

## Manual Testing Checklist

### Backend
- [ ] Free tier: 5 searches limit enforced
- [ ] Premium tier: 50 searches limit enforced
- [ ] Pro tier: 200 searches limit enforced
- [ ] Usage count increments correctly
- [ ] Usage count resets monthly
- [ ] Limit check prevents Tavily API calls when exceeded
- [ ] Graceful degradation (empty results, no errors)
- [ ] Usage tracking metadata is correct

### Frontend
- [ ] Tavily usage displays in UsageDisplay component
- [ ] Tavily usage displays in SubscriptionManager fallback
- [ ] Progress bar shows correct percentage
- [ ] Warning appears at 80% usage
- [ ] Error message appears at 100% usage
- [ ] Upgrade button works correctly
- [ ] Usage stats update in real-time

### API
- [ ] GET /api/subscription returns tavilySearches
- [ ] GET /api/usage/current returns tavilySearches
- [ ] GET /api/usage/warnings includes tavilySearches
- [ ] GET /api/subscription/limits returns tavilySearches

## Running Tests

### Unit Tests
```bash
cd backend
npm test -- tavily-limit.test.ts
```

### Integration Tests
```bash
# Start backend server
npm run dev

# In another terminal, run API tests
curl -X POST http://localhost:3001/api/ai/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Test query",
    "enableWebSearch": true
  }'
```

### Frontend Tests
```bash
cd frontend
npm run dev

# Navigate to http://localhost:3000/dashboard?tab=subscription
# Manually verify Tavily usage display
```

## Expected Results

### Success Criteria
✅ All tier limits are correctly enforced
✅ Usage tracking is accurate
✅ Frontend displays usage correctly
✅ Warnings appear at appropriate thresholds
✅ Graceful degradation when limit exceeded
✅ No errors thrown when limit is reached
✅ Upgrade flow works correctly

### Known Issues
- None currently

## Debugging

### Check Usage Count
```sql
SELECT 
  COUNT(*) as tavily_searches
FROM usage_logs
WHERE user_id = '<user-id>'
  AND type = 'query'
  AND metadata->>'usedTavily' = 'true'
  AND created_at >= date_trunc('month', CURRENT_DATE);
```

### Check Subscription Tier
```sql
SELECT tier, tavily_searches_per_month
FROM subscriptions
WHERE user_id = '<user-id>';
```

### View Recent Usage Logs
```sql
SELECT 
  created_at,
  metadata
FROM usage_logs
WHERE user_id = '<user-id>'
  AND type = 'query'
ORDER BY created_at DESC
LIMIT 10;
```
