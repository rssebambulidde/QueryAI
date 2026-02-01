# Task 7.2.2: Implement Latency Tracking

## Overview
Implemented comprehensive latency tracking system to monitor performance of all major operations, with automatic alerting for high latency and dashboard APIs for visualization.

## Implementation Date
January 26, 2026

## Objectives
- Add timing to all major operations
- Track latency per operation type
- Store latency metrics
- Create latency dashboards
- Set up alerts for high latency

## Files Created

### 1. `backend/src/services/latency-tracker.service.ts`
**Purpose:** Centralized service for tracking latency across all operations

**Key Features:**
- Operation type enumeration (20+ operation types)
- Automatic latency tracking wrapper
- Alert thresholds per operation type
- Statistics calculation (average, min, max, percentiles)
- Trend analysis over time
- Alert generation and storage

**Operation Types:**
- RAG Operations: `RAG_CONTEXT_RETRIEVAL`, `DOCUMENT_SEARCH`, `SEMANTIC_SEARCH`, `KEYWORD_SEARCH`, `WEB_SEARCH`
- Embedding Operations: `EMBEDDING_GENERATION`
- Pinecone Operations: `PINECONE_QUERY`, `PINECONE_UPSERT`, `PINECONE_DELETE`
- AI Operations: `AI_QUESTION_ANSWERING`, `AI_STREAMING`, `AI_OFF_TOPIC_CHECK`, `AI_FOLLOW_UP_GENERATION`, `AI_SUMMARY_GENERATION`
- Processing Operations: `CONTEXT_FORMATTING`, `CONTEXT_COMPRESSION`, `CONTEXT_SUMMARIZATION`, `RERANKING`, `DEDUPLICATION`, `DIVERSITY_FILTERING`
- Other Operations: `CACHE_LOOKUP`, `CACHE_STORE`, `DATABASE_QUERY`, `EXTERNAL_API_CALL`

**Alert Thresholds:**
- Warning and critical thresholds per operation type
- Configurable thresholds
- Automatic alert generation
- Alert storage in database

**Methods:**
- `trackOperation()`: Track operation latency (wrapper function)
- `getLatencyStats()`: Get latency statistics
- `getLatencyTrends()`: Get latency trends over time
- `getRecentAlerts()`: Get recent latency alerts
- `getAlertStats()`: Get alert statistics

### 2. `backend/src/database/migrations/013_latency_metrics.sql`
**Purpose:** Database migration for latency metrics and alerts tables

**Tables Created:**
- `latency_metrics`: Stores latency metrics for all operations
- `latency_alerts`: Stores latency alerts when thresholds are exceeded

**Schema:**
- `latency_metrics`: operation_type, user_id, query_id, duration, timestamp, success, error, metadata
- `latency_alerts`: operation_type, threshold, current_latency, alert_level, message, timestamp

**Indexes:**
- Operation type indexes
- User ID indexes
- Timestamp indexes (DESC for recent queries)
- Composite indexes for common queries
- Duration index for filtering

### 3. `backend/src/database/migrations/014_latency_metrics_rls.sql`
**Purpose:** Row Level Security policies for latency tables

**Policies:**
- Users can view their own latency metrics
- Service role has full access to both tables

## Files Modified

### 1. `backend/src/services/rag.service.ts`
**Changes:**
- Added import for `LatencyTrackerService`
- Wrapped `retrieveContext` with latency tracking
- Wrapped `retrieveDocumentContext` with latency tracking
- Wrapped `retrieveDocumentContextKeyword` with latency tracking
- Wrapped `retrieveWebSearch` with latency tracking
- Wrapped `formatContextForPrompt` with latency tracking
- Wrapped embedding generation with latency tracking
- Wrapped Pinecone queries with latency tracking
- Wrapped reranking with latency tracking
- Wrapped deduplication with latency tracking
- Wrapped diversity filtering with latency tracking
- Wrapped context summarization with latency tracking
- Wrapped context compression with latency tracking

**Latency Tracking Points:**
1. **RAG Context Retrieval**: Entire context retrieval process
2. **Document Search**: Document search operations
3. **Semantic Search**: Pinecone semantic search
4. **Keyword Search**: BM25 keyword search
5. **Web Search**: Tavily web search
6. **Embedding Generation**: OpenAI embedding generation
7. **Pinecone Query**: Pinecone vector queries
8. **Context Formatting**: Context formatting for prompts
9. **Reranking**: Result reranking
10. **Deduplication**: Result deduplication
11. **Diversity Filtering**: MMR diversity filtering
12. **Context Summarization**: Context summarization
13. **Context Compression**: Context compression

### 2. `backend/src/services/ai.service.ts`
**Changes:**
- Added import for `LatencyTrackerService`
- Wrapped `answerQuestion` with latency tracking
- Wrapped `answerQuestionStream` with latency tracking (custom implementation for generators)
- Wrapped `runOffTopicPreCheck` with latency tracking
- Wrapped `generateFollowUpQuestions` with latency tracking
- Added `userId` parameter to `formatContextForPrompt` calls

**Latency Tracking Points:**
1. **AI Question Answering**: Main question answering flow
2. **AI Streaming**: Streaming response generation
3. **AI Off-Topic Check**: Off-topic pre-check
4. **AI Follow-Up Generation**: Follow-up question generation

### 3. `backend/src/routes/metrics.routes.ts`
**Changes:**
- Added import for `LatencyTrackerService`
- Added `GET /api/metrics/latency/stats` endpoint
- Added `GET /api/metrics/latency/trends` endpoint
- Added `GET /api/metrics/latency/alerts` endpoint
- Added `GET /api/metrics/latency/alerts/stats` endpoint

## Implementation Details

### Latency Tracking

#### Operation Wrapper
```typescript
const result = await LatencyTrackerService.trackOperation(
  OperationType.RAG_CONTEXT_RETRIEVAL,
  async () => {
    return await operation();
  },
  {
    userId: 'user-123',
    metadata: { /* additional context */ },
  }
);
```

#### Automatic Tracking
- Tracks start and end time
- Calculates duration
- Records success/failure
- Stores metadata
- Checks for alerts
- Logs slow operations (>1000ms)

### Alert Thresholds

#### Default Thresholds (milliseconds)
- **RAG Context Retrieval**: Warning: 2000ms, Critical: 5000ms
- **Document Search**: Warning: 1500ms, Critical: 3000ms
- **Semantic Search**: Warning: 1000ms, Critical: 2500ms
- **Keyword Search**: Warning: 500ms, Critical: 1500ms
- **Web Search**: Warning: 3000ms, Critical: 8000ms
- **Embedding Generation**: Warning: 2000ms, Critical: 5000ms
- **Pinecone Query**: Warning: 1000ms, Critical: 3000ms
- **AI Question Answering**: Warning: 5000ms, Critical: 15000ms
- **AI Streaming**: Warning: 1000ms, Critical: 3000ms
- **Context Formatting**: Warning: 500ms, Critical: 1500ms
- **Context Compression**: Warning: 1000ms, Critical: 3000ms
- **Context Summarization**: Warning: 2000ms, Critical: 5000ms
- **Reranking**: Warning: 1000ms, Critical: 3000ms
- **Deduplication**: Warning: 500ms, Critical: 1500ms
- **Diversity Filtering**: Warning: 500ms, Critical: 1500ms
- **Cache Lookup**: Warning: 100ms, Critical: 500ms
- **Cache Store**: Warning: 200ms, Critical: 1000ms
- **Database Query**: Warning: 500ms, Critical: 2000ms
- **External API Call**: Warning: 3000ms, Critical: 10000ms

### Statistics Calculation

#### Metrics Calculated
- `count`: Number of operations
- `averageLatency`: Average duration
- `minLatency`: Minimum duration
- `maxLatency`: Maximum duration
- `p50`: Median (50th percentile)
- `p95`: 95th percentile
- `p99`: 99th percentile
- `successRate`: Percentage of successful operations
- `errorRate`: Percentage of failed operations

### Trend Analysis

#### Time Intervals
- `hour`: Hourly trends
- `day`: Daily trends
- `week`: Weekly trends

#### Trend Metrics
- Average latency per period
- Count of operations per period
- P95 latency per period
- P99 latency per period

### Alert System

#### Alert Levels
- **Warning**: Latency exceeds warning threshold
- **Critical**: Latency exceeds critical threshold

#### Alert Storage
- Alerts stored in `latency_alerts` table
- Includes operation type, threshold, actual latency, level, message
- Timestamped for analysis

## Usage Examples

### Track Operation Latency
```typescript
import { LatencyTrackerService, OperationType } from './services/latency-tracker.service';

const result = await LatencyTrackerService.trackOperation(
  OperationType.DOCUMENT_SEARCH,
  async () => {
    return await searchDocuments(query);
  },
  {
    userId: 'user-123',
    metadata: {
      queryLength: query.length,
      topicId: 'topic-123',
    },
  }
);
```

### Get Latency Statistics
```typescript
const stats = await LatencyTrackerService.getLatencyStats({
  operationType: OperationType.RAG_CONTEXT_RETRIEVAL,
  userId: 'user-123',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

console.log({
  averageLatency: stats[0].averageLatency,
  p95: stats[0].p95,
  p99: stats[0].p99,
  successRate: stats[0].successRate,
});
```

### Get Latency Trends
```typescript
const trends = await LatencyTrackerService.getLatencyTrends(
  OperationType.AI_QUESTION_ANSWERING,
  '2026-01-01',
  '2026-01-31',
  'day'
);

trends.forEach(trend => {
  console.log({
    period: trend.period,
    averageLatency: trend.averageLatency,
    p95: trend.p95,
  });
});
```

### Get Recent Alerts
```typescript
const alerts = await LatencyTrackerService.getRecentAlerts(50);

alerts.forEach(alert => {
  console.log({
    operationType: alert.operationType,
    alertLevel: alert.alertLevel,
    currentLatency: alert.currentLatency,
    threshold: alert.threshold,
    message: alert.message,
  });
});
```

## API Endpoints

### Get Latency Statistics
```bash
GET /api/metrics/latency/stats?operationType=rag_context_retrieval&startDate=2026-01-01&endDate=2026-01-31&limit=100
Authorization: Bearer {token}
```

**Query Parameters:**
- `operationType` (optional): Filter by operation type
- `userId` (auto): Current user ID
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `minLatency` (optional): Minimum latency filter (ms)
- `maxLatency` (optional): Maximum latency filter (ms)
- `limit` (optional): Maximum number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "operationType": "rag_context_retrieval",
        "count": 150,
        "averageLatency": 1250,
        "minLatency": 500,
        "maxLatency": 3500,
        "p50": 1200,
        "p95": 2500,
        "p99": 3000,
        "successRate": 98.0,
        "errorRate": 2.0
      }
    ],
    "summary": {
      "totalOperations": 150,
      "averageLatency": 1250,
      "operationsTracked": 1
    }
  }
}
```

### Get Latency Trends
```bash
GET /api/metrics/latency/trends?operationType=ai_question_answering&startDate=2026-01-01&endDate=2026-01-31&interval=day
Authorization: Bearer {token}
```

**Query Parameters:**
- `operationType` (required): Operation type
- `startDate` (required): Start date (ISO format)
- `endDate` (required): End date (ISO format)
- `interval` (optional): Time interval (hour, day, week)

**Response:**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "period": "2026-01-01",
        "averageLatency": 1200,
        "count": 50,
        "p95": 2500,
        "p99": 3000
      },
      {
        "period": "2026-01-02",
        "averageLatency": 1300,
        "count": 55,
        "p95": 2600,
        "p99": 3100
      }
    ],
    "operationType": "ai_question_answering",
    "interval": "day",
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    }
  }
}
```

### Get Recent Alerts
```bash
GET /api/metrics/latency/alerts?limit=50
Authorization: Bearer {token}
```

**Query Parameters:**
- `limit` (optional): Maximum number of alerts (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "operationType": "rag_context_retrieval",
        "threshold": 5000,
        "currentLatency": 5500,
        "alertLevel": "critical",
        "message": "Critical latency alert: rag_context_retrieval took 5500ms (threshold: 5000ms)",
        "timestamp": 1234567890
      }
    ],
    "total": 5
  }
}
```

### Get Alert Statistics
```bash
GET /api/metrics/latency/alerts/stats?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAlerts": 25,
    "criticalAlerts": 5,
    "warningAlerts": 20,
    "alertsByOperation": {
      "rag_context_retrieval": 10,
      "ai_question_answering": 8,
      "web_search": 7
    }
  }
}
```

## Acceptance Criteria

✅ **Latency tracked accurately**
- All major operations wrapped with latency tracking
- Duration calculated correctly
- Success/failure tracked
- Metadata stored

✅ **Dashboards show trends**
- Statistics endpoint available
- Trends endpoint available
- Percentiles calculated (p50, p95, p99)
- Time-based aggregation working

✅ **Alerts configured**
- Alert thresholds defined per operation
- Alerts generated automatically
- Alerts stored in database
- Alert statistics available

## Testing Recommendations

1. **Latency Tracking:**
   - Test operation wrapping
   - Test duration calculation
   - Test metadata storage
   - Test error handling

2. **Statistics:**
   - Test statistics calculation
   - Test percentile calculation
   - Test filtering
   - Test aggregation

3. **Trends:**
   - Test hourly trends
   - Test daily trends
   - Test weekly trends
   - Test date range filtering

4. **Alerts:**
   - Test alert generation
   - Test alert thresholds
   - Test alert storage
   - Test alert statistics

5. **Integration:**
   - Test with RAG service
   - Test with AI service
   - Test API endpoints
   - Test database storage

## Database Migration

### Run Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open `013_latency_metrics.sql`
3. Copy and paste the SQL
4. Click **Run** to execute
5. Repeat for `014_latency_metrics_rls.sql`

### Verify Migration
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('latency_metrics', 'latency_alerts');

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('latency_metrics', 'latency_alerts');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('latency_metrics', 'latency_alerts');
```

## Configuration

### Alert Thresholds
Thresholds are defined per operation type in `LatencyTrackerService.ALERT_THRESHOLDS`. Can be adjusted based on:
- Service level agreements (SLAs)
- Performance requirements
- Historical data analysis

### Slow Operation Logging
Operations taking longer than 1000ms are automatically logged as warnings.

## Troubleshooting

### Latency Not Tracked
- Check operation is wrapped with `trackOperation`
- Verify service is imported
- Check error logs
- Verify database connection

### Statistics Not Accurate
- Check database queries
- Verify percentile calculation
- Review filtering logic
- Test with sample data

### Alerts Not Generated
- Check alert thresholds
- Verify alert generation logic
- Review alert storage
- Check error logs

## Future Enhancements

- Real-time latency monitoring dashboard
- Latency visualization charts
- Automated alert notifications (email, Slack, etc.)
- Latency-based auto-scaling
- Performance regression detection
- Latency budget tracking
- Operation dependency analysis
- Latency correlation analysis
- Machine learning for latency prediction
- Adaptive threshold adjustment
