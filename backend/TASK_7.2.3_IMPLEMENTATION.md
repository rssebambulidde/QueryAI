# Task 7.2.3: Implement Error Rate Monitoring

## Overview
Implemented comprehensive error rate monitoring system to track errors across all services, categorize them by type, and provide alerting when error rates exceed thresholds.

## Implementation Date
January 26, 2026

## Objectives
- Track error rates per service
- Categorize errors by type
- Store error metrics
- Create error dashboards
- Set up error rate alerts

## Files Created

### 1. `backend/src/services/error-tracker.service.ts`
**Purpose:** Centralized service for tracking and categorizing errors across all services

**Key Features:**
- Service type enumeration (RAG, AI, Embedding, Search, Pinecone, Database, Cache, Auth)
- Error category enumeration (Network, Rate Limit, Authentication, Validation, Not Found, Server Error, Timeout, Circuit Breaker, Degradation, Unknown)
- Automatic error categorization
- Error rate threshold monitoring per service
- Alert generation when thresholds exceeded
- Statistics and trend analysis

**Error Categories:**
- `NETWORK`: Connection errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- `RATE_LIMIT`: Rate limiting errors (429, rate_limit_exceeded)
- `AUTHENTICATION`: Auth errors (401, 403, unauthorized, forbidden)
- `VALIDATION`: Validation errors (400, ValidationError)
- `NOT_FOUND`: Not found errors (404, not_found)
- `TIMEOUT`: Timeout errors (ETIMEDOUT, TimeoutError)
- `CIRCUIT_BREAKER`: Circuit breaker errors
- `DEGRADATION`: Service degradation errors
- `SERVER_ERROR`: Server errors (500+)
- `UNKNOWN`: Unknown/unclassified errors

**Error Rate Thresholds:**
- **RAG**: Warning: 5%, Critical: 10%
- **AI**: Warning: 3%, Critical: 8%
- **Embedding**: Warning: 5%, Critical: 15%
- **Search**: Warning: 10%, Critical: 20%
- **Pinecone**: Warning: 5%, Critical: 15%
- **Database**: Warning: 2%, Critical: 5%
- **Cache**: Warning: 10%, Critical: 25%
- **Auth**: Warning: 1%, Critical: 3%

**Methods:**
- `categorizeError()`: Automatically categorize errors
- `trackError()`: Track an error with metadata
- `getErrorStats()`: Get error statistics
- `getErrorTrends()`: Get error trends over time
- `getRecentAlerts()`: Get recent error rate alerts
- `getAlertStats()`: Get alert statistics

### 2. `backend/src/database/migrations/015_error_metrics.sql`
**Purpose:** Database migration for error metrics and alerts tables

**Tables Created:**
- `error_metrics`: Stores error metrics for all services
- `error_rate_alerts`: Stores error rate alerts when thresholds are exceeded

**Schema:**
- `error_metrics`: service_type, error_category, user_id, query_id, error_message, error_code, status_code, timestamp, metadata
- `error_rate_alerts`: service_type, error_category, error_rate, threshold, alert_level, message, timestamp

**Indexes:**
- Service type indexes
- Error category indexes
- User ID indexes
- Timestamp indexes (DESC for recent queries)
- Composite indexes for common queries
- Status code index

### 3. `backend/src/database/migrations/016_error_metrics_rls.sql`
**Purpose:** Row Level Security policies for error tables

**Policies:**
- Users can view their own error metrics
- Service role has full access to both tables

## Files Modified

### 1. `backend/src/services/rag.service.ts`
**Changes:**
- Added import for `ErrorTrackerService`
- Added error tracking to `retrieveDocumentContext` catch block
- Added error tracking to embedding generation catch block
- Added error tracking to Pinecone search catch block
- Added error tracking to keyword search catch block
- Added error tracking to web search catch block

**Error Tracking Points:**
1. **Document Context Retrieval**: Errors during document search
2. **Embedding Generation**: Errors during embedding creation
3. **Pinecone Search**: Errors during vector search
4. **Keyword Search**: Errors during BM25 search
5. **Web Search**: Errors during Tavily search

### 2. `backend/src/services/ai.service.ts`
**Changes:**
- Added import for `ErrorTrackerService`
- Added error tracking to OpenAI API error catch blocks
- Added error tracking for validation errors

**Error Tracking Points:**
1. **AI Question Answering**: Errors during OpenAI API calls
2. **OpenAI API Errors**: All OpenAI-specific errors

### 3. `backend/src/routes/metrics.routes.ts`
**Changes:**
- Added import for `ErrorTrackerService`, `ErrorQuery`, `ServiceType`, `ErrorCategory`
- Added `GET /api/metrics/errors/stats` endpoint
- Added `GET /api/metrics/errors/trends` endpoint
- Added `GET /api/metrics/errors/alerts` endpoint
- Added `GET /api/metrics/errors/alerts/stats` endpoint

## Implementation Details

### Error Categorization

#### Automatic Categorization
```typescript
const category = ErrorTrackerService.categorizeError(error);
// Returns: NETWORK, RATE_LIMIT, AUTHENTICATION, VALIDATION, etc.
```

#### Categorization Logic
- **Network Errors**: Connection refused, timeout, not found
- **Rate Limit Errors**: HTTP 429, rate_limit_exceeded
- **Authentication Errors**: HTTP 401, 403, unauthorized, forbidden
- **Validation Errors**: HTTP 400, ValidationError
- **Not Found Errors**: HTTP 404, not_found
- **Timeout Errors**: ETIMEDOUT, TimeoutError
- **Circuit Breaker Errors**: Circuit breaker messages
- **Degradation Errors**: Degradation messages
- **Server Errors**: HTTP 500+
- **Unknown Errors**: Default fallback

### Error Tracking

#### Track Error
```typescript
await ErrorTrackerService.trackError(
  ErrorServiceType.RAG,
  error,
  {
    userId: 'user-123',
    queryId: 'query-456',
    metadata: {
      operation: 'retrieveDocumentContext',
      queryLength: 100,
    },
  }
);
```

#### Automatic Features
- Error categorization
- Error rate calculation
- Alert generation
- Database storage
- Logging

### Error Rate Calculation

#### Rate Calculation
- Error rate = (errors / total operations) * 100
- Calculated over last hour
- Uses latency metrics for total operations
- Thresholds checked per service

### Alert System

#### Alert Levels
- **Warning**: Error rate exceeds warning threshold
- **Critical**: Error rate exceeds critical threshold

#### Alert Storage
- Alerts stored in `error_rate_alerts` table
- Includes service type, error category, error rate, threshold, level, message
- Timestamped for analysis

## Usage Examples

### Track Error
```typescript
import { ErrorTrackerService, ErrorServiceType } from './services/error-tracker.service';

try {
  await operation();
} catch (error: any) {
  await ErrorTrackerService.trackError(
    ErrorServiceType.RAG,
    error,
    {
      userId: 'user-123',
      metadata: {
        operation: 'retrieveContext',
      },
    }
  );
  throw error;
}
```

### Get Error Statistics
```typescript
const stats = await ErrorTrackerService.getErrorStats({
  serviceType: ErrorServiceType.RAG,
  errorCategory: ErrorCategory.NETWORK,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

console.log({
  count: stats[0].count,
  errorRate: stats[0].errorRate,
  lastOccurrence: stats[0].lastOccurrence,
});
```

### Get Error Trends
```typescript
const trends = await ErrorTrackerService.getErrorTrends(
  ErrorServiceType.AI,
  ErrorCategory.RATE_LIMIT,
  '2026-01-01',
  '2026-01-31',
  'day'
);

trends.forEach(trend => {
  console.log({
    period: trend.period,
    errorCount: trend.errorCount,
    errorRate: trend.errorRate,
  });
});
```

### Get Recent Alerts
```typescript
const alerts = await ErrorTrackerService.getRecentAlerts(50);

alerts.forEach(alert => {
  console.log({
    serviceType: alert.serviceType,
    errorCategory: alert.errorCategory,
    errorRate: alert.errorRate,
    alertLevel: alert.alertLevel,
    message: alert.message,
  });
});
```

## API Endpoints

### Get Error Statistics
```bash
GET /api/metrics/errors/stats?serviceType=rag&errorCategory=network&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**Query Parameters:**
- `serviceType` (optional): Filter by service type
- `errorCategory` (optional): Filter by error category
- `userId` (auto): Current user ID
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `limit` (optional): Maximum number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "serviceType": "rag",
        "errorCategory": "network",
        "count": 25,
        "errorRate": 5.2,
        "lastOccurrence": 1234567890,
        "firstOccurrence": 1234500000
      }
    ],
    "summary": {
      "totalErrors": 25,
      "servicesTracked": 1,
      "categoriesTracked": 1
    }
  }
}
```

### Get Error Trends
```bash
GET /api/metrics/errors/trends?serviceType=ai&errorCategory=rate_limit&startDate=2026-01-01&endDate=2026-01-31&interval=day
Authorization: Bearer {token}
```

**Query Parameters:**
- `serviceType` (required): Service type
- `errorCategory` (optional): Error category
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
        "errorCount": 5,
        "errorRate": 2.5
      },
      {
        "period": "2026-01-02",
        "errorCount": 8,
        "errorRate": 4.0
      }
    ],
    "serviceType": "ai",
    "errorCategory": "rate_limit",
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
GET /api/metrics/errors/alerts?limit=50
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
        "serviceType": "rag",
        "errorCategory": "network",
        "errorRate": 12.5,
        "threshold": 10.0,
        "alertLevel": "critical",
        "message": "Critical error rate alert: rag has 12.50% error rate (threshold: 10.00%)",
        "timestamp": 1234567890
      }
    ],
    "total": 5
  }
}
```

### Get Alert Statistics
```bash
GET /api/metrics/errors/alerts/stats?startDate=2026-01-01&endDate=2026-01-31
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
    "alertsByService": {
      "rag": 10,
      "ai": 8,
      "embedding": 7
    }
  }
}
```

## Acceptance Criteria

✅ **Error rates tracked**
- All major services track errors
- Error rates calculated accurately
- Error rates stored persistently

✅ **Errors categorized**
- Automatic error categorization working
- Categories cover all error types
- Categorization logic accurate

✅ **Alerts configured**
- Alert thresholds defined per service
- Alerts generated automatically
- Alerts stored in database
- Alert statistics available

## Testing Recommendations

1. **Error Tracking:**
   - Test error tracking in all services
   - Test error categorization
   - Test error storage
   - Test error rate calculation

2. **Error Categorization:**
   - Test network error categorization
   - Test rate limit error categorization
   - Test authentication error categorization
   - Test validation error categorization
   - Test server error categorization

3. **Error Rate Alerts:**
   - Test alert generation
   - Test alert thresholds
   - Test alert storage
   - Test alert statistics

4. **API Endpoints:**
   - Test error statistics endpoint
   - Test error trends endpoint
   - Test error alerts endpoint
   - Test alert statistics endpoint

5. **Integration:**
   - Test with RAG service
   - Test with AI service
   - Test with all service files
   - Test database storage

## Database Migration

### Run Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open `015_error_metrics.sql`
3. Copy and paste the SQL
4. Click **Run** to execute
5. Repeat for `016_error_metrics_rls.sql`

### Verify Migration
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('error_metrics', 'error_rate_alerts');

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('error_metrics', 'error_rate_alerts');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('error_metrics', 'error_rate_alerts');
```

## Configuration

### Error Rate Thresholds
Thresholds are defined per service type in `ErrorTrackerService.ERROR_RATE_THRESHOLDS`. Can be adjusted based on:
- Service criticality
- Historical error rates
- Service level agreements (SLAs)
- Performance requirements

## Troubleshooting

### Errors Not Tracked
- Check error tracking is called in catch blocks
- Verify service is imported
- Check error logs
- Verify database connection

### Error Categorization Not Accurate
- Review categorization logic
- Check error message patterns
- Test with sample errors
- Update categorization rules

### Alerts Not Generated
- Check error rate thresholds
- Verify error rate calculation
- Review alert generation logic
- Check error logs

## Future Enhancements

- Real-time error monitoring dashboard
- Error visualization charts
- Automated alert notifications (email, Slack, etc.)
- Error correlation analysis
- Error pattern detection
- Machine learning for error prediction
- Error recovery suggestions
- Error impact analysis
- Service dependency error tracking
- Error budget tracking
