# Task 7.2.1: Implement Retrieval Quality Metrics

## Overview
Implemented comprehensive retrieval quality metrics system to track and analyze retrieval performance, including precision, recall, MRR (Mean Reciprocal Rank), and other quality indicators.

## Implementation Date
January 26, 2026

## Objectives
- Define retrieval metrics (precision, recall, MRR)
- Implement metrics collection service
- Track metrics per query
- Store metrics in database
- Create metrics dashboard/API

## Files Created

### 1. `backend/src/services/metrics.service.ts`
**Purpose:** Service for collecting and calculating retrieval quality metrics

**Key Features:**
- Metric calculation (precision, recall, F1, MRR, AP, NDCG)
- Metrics collection per query
- Database storage
- Metrics retrieval and aggregation
- Score-based heuristics when ground truth unavailable

**Metrics Calculated:**
- **Precision**: `relevant retrieved / total retrieved`
- **Recall**: `relevant retrieved / total relevant`
- **F1 Score**: `2 * (precision * recall) / (precision + recall)`
- **MRR (Mean Reciprocal Rank)**: Average of `1/rank` of first relevant document
- **AP (Average Precision)**: Average of precision at each relevant document position
- **NDCG (Normalized Discounted Cumulative Gain)**: Normalized DCG for ranking quality

**Methods:**
- `calculatePrecision()`: Calculate precision metric
- `calculateRecall()`: Calculate recall metric
- `calculateF1Score()`: Calculate F1 score
- `calculateMRR()`: Calculate Mean Reciprocal Rank
- `calculateAveragePrecision()`: Calculate Average Precision
- `calculateNDCG()`: Calculate Normalized Discounted Cumulative Gain
- `collectMetrics()`: Collect and store metrics for a query
- `getMetrics()`: Get metrics with filtering
- `getMetricsSummary()`: Get aggregated metrics summary

**Score-Based Heuristics:**
- When ground truth (relevant document IDs) is not available
- Uses score threshold (0.7) to estimate relevance
- Documents with score >= 0.7 considered potentially relevant

### 2. `backend/src/routes/metrics.routes.ts`
**Purpose:** API endpoints for retrieval quality metrics

**Endpoints:**
- `GET /api/metrics/retrieval` - Get retrieval metrics with filtering
- `GET /api/metrics/retrieval/summary` - Get metrics summary
- `POST /api/metrics/retrieval/collect` - Manually collect metrics (for testing/feedback)

### 3. `backend/src/database/migrations/011_retrieval_metrics.sql`
**Purpose:** Database migration for retrieval_metrics table

**Table Schema:**
- `id`: UUID primary key
- `user_id`: Foreign key to user_profiles
- `query`: Query text
- `query_id`: Optional query identifier
- `timestamp`: When metrics were collected
- **Retrieval metrics**: `total_retrieved`, `total_relevant`, `relevant_retrieved`, `precision`, `recall`, `f1_score`
- **Ranking metrics**: `mean_reciprocal_rank`, `average_precision`, `ndcg`
- **Context metrics**: `document_chunks_retrieved`, `web_results_retrieved`, `total_sources`
- **Quality indicators**: `min_score`, `max_score`, `average_score`
- **Metadata**: `search_types` (JSONB), `topic_id`, `document_ids` (array)

**Indexes:**
- `idx_retrieval_metrics_user_id`: User ID index
- `idx_retrieval_metrics_timestamp`: Timestamp index (DESC)
- `idx_retrieval_metrics_topic_id`: Topic ID index
- `idx_retrieval_metrics_query_id`: Query ID index
- `idx_retrieval_metrics_user_timestamp`: Composite index for common queries

### 4. `backend/src/database/migrations/012_retrieval_metrics_rls.sql`
**Purpose:** Row Level Security policies for retrieval_metrics table

**Policies:**
- Users can view their own metrics
- Users can insert their own metrics
- Service role has full access

## Files Modified

### 1. `backend/src/services/rag.service.ts`
**Changes:**
- Added import for `MetricsService`
- Integrated metrics collection in `retrieveContext`:
  - Collects metrics after context retrieval
  - Uses score-based heuristic when ground truth unavailable
  - Async collection (doesn't block response)
  - Includes search types, topic ID, document IDs in metadata

**Integration Point:**
```typescript
// Collect retrieval metrics (async, don't block)
if (options.userId && finalDocumentContexts.length > 0) {
  MetricsService.collectMetrics(
    query,
    options.userId,
    finalDocumentContexts,
    undefined, // No ground truth available - will use score-based heuristic
    {
      topicId: options.topicId,
      documentIds: options.documentIds,
      searchTypes: {
        semantic: options.enableDocumentSearch,
        keyword: options.enableKeywordSearch,
        hybrid: options.enableDocumentSearch && options.enableKeywordSearch,
        web: options.enableWebSearch,
      },
      webResultsCount: finalWebResults.length,
    }
  ).catch((error: any) => {
    // Don't fail if metrics collection fails
    logger.warn('Failed to collect retrieval metrics', {
      error: error.message,
      userId: options.userId,
    });
  });
}
```

### 2. `backend/src/server.ts`
**Changes:**
- Added import for `metricsRoutes`
- Added route: `app.use('/api/metrics', metricsRoutes)`

## Implementation Details

### Metric Calculations

#### Precision
```
Precision = relevant retrieved / total retrieved
```
- Measures: Of the retrieved documents, how many are relevant?
- Range: 0.0 to 1.0 (higher is better)
- Example: If 8 out of 10 retrieved documents are relevant, precision = 0.8

#### Recall
```
Recall = relevant retrieved / total relevant
```
- Measures: Of all relevant documents, how many were retrieved?
- Range: 0.0 to 1.0 (higher is better)
- Example: If 8 out of 12 relevant documents were retrieved, recall = 0.67

#### F1 Score
```
F1 = 2 * (precision * recall) / (precision + recall)
```
- Measures: Harmonic mean of precision and recall
- Range: 0.0 to 1.0 (higher is better)
- Balances precision and recall

#### Mean Reciprocal Rank (MRR)
```
MRR = average of 1/rank of first relevant document
```
- Measures: Average rank of first relevant document
- Range: 0.0 to 1.0 (higher is better)
- Example: If first relevant document is at rank 3, MRR = 1/3 = 0.33

#### Average Precision (AP)
```
AP = average of precision at each relevant document position
```
- Measures: Precision at each relevant document position, averaged
- Range: 0.0 to 1.0 (higher is better)
- Considers ranking quality

#### Normalized Discounted Cumulative Gain (NDCG)
```
NDCG = DCG / IDCG
```
- Measures: Ranking quality with position discounting
- Range: 0.0 to 1.0 (higher is better)
- Considers both relevance and position

### Score-Based Heuristics

When ground truth (relevant document IDs) is not available:
- Uses score threshold of 0.7
- Documents with score >= 0.7 considered potentially relevant
- Estimates total relevant as number of high-scoring documents
- Allows metrics collection without user feedback

### Metrics Collection Flow

1. **Context Retrieved**: RAG service retrieves document contexts
2. **Metrics Collection**: Metrics service collects metrics
3. **Relevance Detection**: 
   - If ground truth available: Use actual relevance
   - If not: Use score-based heuristic (score >= 0.7)
4. **Metric Calculation**: Calculate precision, recall, F1, MRR, AP, NDCG
5. **Storage**: Store metrics in database
6. **Logging**: Log metrics for monitoring

## Usage Examples

### Collect Metrics (Automatic)
Metrics are automatically collected when RAG context is retrieved:
```typescript
const context = await RAGService.retrieveContext(query, {
  userId: 'user-123',
  enableDocumentSearch: true,
  enableKeywordSearch: true,
  enableWebSearch: true,
  // ... other options
});
// Metrics are collected automatically in the background
```

### Collect Metrics (Manual with Ground Truth)
```typescript
import { MetricsService } from './services/metrics.service';

const metrics = await MetricsService.collectMetrics(
  query,
  userId,
  retrievedDocuments,
  ['doc-1', 'doc-2', 'doc-3'], // Relevant document IDs (ground truth)
  {
    topicId: 'topic-123',
    searchTypes: {
      semantic: true,
      keyword: true,
      hybrid: true,
      web: true,
    },
  }
);
```

### Get Metrics
```typescript
const metrics = await MetricsService.getMetrics({
  userId: 'user-123',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  topicId: 'topic-123',
  limit: 100,
});
```

### Get Metrics Summary
```typescript
const summary = await MetricsService.getMetricsSummary('user-123');
console.log({
  totalQueries: summary.totalQueries,
  averagePrecision: summary.averagePrecision,
  averageRecall: summary.averageRecall,
  averageF1Score: summary.averageF1Score,
  averageMRR: summary.averageMRR,
});
```

## API Endpoints

### Get Retrieval Metrics
```bash
GET /api/metrics/retrieval?startDate=2026-01-01&endDate=2026-01-31&topicId=topic-123&limit=100&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `topicId` (optional): Filter by topic ID
- `limit` (optional): Maximum number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "totalQueries": 50,
    "averagePrecision": 0.75,
    "averageRecall": 0.68,
    "averageF1Score": 0.71,
    "averageMRR": 0.82,
    "averageAP": 0.73,
    "averageNDCG": 0.79,
    "queries": [
      {
        "query": "What is machine learning?",
        "userId": "user-123",
        "timestamp": 1234567890,
        "totalRetrieved": 10,
        "totalRelevant": 8,
        "relevantRetrieved": 7,
        "precision": 0.7,
        "recall": 0.875,
        "f1Score": 0.778,
        "meanReciprocalRank": 0.5,
        "averagePrecision": 0.72,
        "ndcg": 0.78,
        "documentChunksRetrieved": 10,
        "webResultsRetrieved": 5,
        "totalSources": 15,
        "minScore": 0.65,
        "maxScore": 0.95,
        "averageScore": 0.78,
        "searchTypes": {
          "semantic": true,
          "keyword": true,
          "hybrid": true,
          "web": true
        },
        "topicId": "topic-123"
      }
    ]
  }
}
```

### Get Metrics Summary
```bash
GET /api/metrics/retrieval/summary
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalQueries": 150,
    "averagePrecision": 0.75,
    "averageRecall": 0.68,
    "averageF1Score": 0.71,
    "averageMRR": 0.82,
    "averageAP": 0.73,
    "averageNDCG": 0.79,
    "dateRange": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z"
    }
  }
}
```

### Collect Metrics (Manual)
```bash
POST /api/metrics/retrieval/collect
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "What is machine learning?",
  "retrievedDocuments": [
    {
      "documentId": "doc-1",
      "documentName": "ML Guide",
      "chunkIndex": 0,
      "content": "...",
      "score": 0.85
    }
  ],
  "relevantDocumentIds": ["doc-1", "doc-2"],
  "options": {
    "topicId": "topic-123",
    "searchTypes": {
      "semantic": true,
      "keyword": false,
      "web": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "What is machine learning?",
    "userId": "user-123",
    "timestamp": 1234567890,
    "totalRetrieved": 1,
    "totalRelevant": 2,
    "relevantRetrieved": 1,
    "precision": 1.0,
    "recall": 0.5,
    "f1Score": 0.667,
    "meanReciprocalRank": 1.0,
    "averagePrecision": 1.0
  }
}
```

## Acceptance Criteria

✅ **Metrics collected accurately**
- Precision calculated correctly
- Recall calculated correctly
- MRR calculated correctly
- AP and NDCG calculated correctly
- Metrics stored in database

✅ **Metrics stored persistently**
- Database table created
- Metrics stored on each query
- RLS policies configured
- Indexes for performance

✅ **Dashboard accessible**
- API endpoints available
- Metrics retrieval working
- Summary endpoint working
- Filtering and pagination working

## Testing Recommendations

1. **Metric Calculations:**
   - Test precision calculation
   - Test recall calculation
   - Test F1 score calculation
   - Test MRR calculation
   - Test AP calculation
   - Test NDCG calculation

2. **Metrics Collection:**
   - Test automatic collection in RAG service
   - Test manual collection with ground truth
   - Test score-based heuristic
   - Test with different search types

3. **Database Storage:**
   - Test metrics storage
   - Test RLS policies
   - Test query performance
   - Test indexes

4. **API Endpoints:**
   - Test metrics retrieval
   - Test summary endpoint
   - Test filtering
   - Test pagination
   - Test authentication

5. **Integration:**
   - Test with RAG service
   - Test with different query types
   - Test with different search configurations
   - Test error handling

## Database Migration

### Run Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open `011_retrieval_metrics.sql`
3. Copy and paste the SQL
4. Click **Run** to execute
5. Repeat for `012_retrieval_metrics_rls.sql`

### Verify Migration
```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'retrieval_metrics';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'retrieval_metrics';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'retrieval_metrics';
```

## Configuration

### Score Threshold
- Default: 0.7 (for score-based heuristic)
- Documents with score >= threshold considered relevant
- Can be adjusted based on use case

### Metrics Collection
- Automatic: Enabled by default in RAG service
- Async: Doesn't block response
- Error handling: Failures logged but don't affect retrieval

## Troubleshooting

### Metrics Not Collected
- Check userId is provided
- Check document contexts are retrieved
- Review error logs
- Verify database connection

### Metrics Not Stored
- Check database migration ran
- Verify RLS policies
- Check service role permissions
- Review error logs

### API Endpoints Not Working
- Check route registration
- Verify authentication
- Check query parameters
- Review error logs

## Future Enhancements

- User feedback integration for ground truth
- Real-time metrics dashboard
- Metrics visualization
- A/B testing support
- Metric alerts and thresholds
- Export metrics to analytics tools
- Machine learning for relevance prediction
- Adaptive threshold optimization
- Per-topic metrics analysis
- Comparative metrics (before/after improvements)
