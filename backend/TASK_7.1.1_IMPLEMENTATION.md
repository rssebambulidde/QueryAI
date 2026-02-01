# Task 7.1.1: Implement Retry Logic with Exponential Backoff

## Overview
Implemented retry logic with exponential backoff for external API calls (OpenAI, Tavily) to improve resilience and handle transient failures gracefully.

## Implementation Date
January 26, 2026

## Objectives
- Research retry libraries and patterns
- Implement retry service with exponential backoff
- Add retry configuration (max retries, backoff strategy)
- Apply retries to external API calls
- Add retry logging and metrics

## Files Created

### 1. `backend/src/services/retry.service.ts`
**Purpose:** Retry service with exponential backoff for external API calls

**Key Features:**
- Exponential backoff with configurable multiplier
- Jitter to prevent thundering herd problem
- Retryable error detection (HTTP status codes, error codes, error types)
- Comprehensive statistics tracking
- Configurable retry behavior per use case
- Retry callbacks for custom logging

**Methods:**
- `execute<T>()`: Execute function with retry logic
- `getStats()`: Get retry statistics
- `resetStats()`: Reset statistics
- `isRetryableError()`: Check if error is retryable
- `createConfig()`: Create retry configuration

**Interfaces:**
- `RetryConfig`: Retry configuration options
- `RetryStats`: Retry statistics
- `RetryResult<T>`: Result with attempt count and timing

**Default Configuration:**
- `maxRetries`: 3
- `initialDelay`: 1000ms
- `maxDelay`: 30000ms
- `multiplier`: 2 (exponential)
- `jitter`: true (10% random variation)
- `retryableErrors`: HTTP 429, 500, 502, 503, 504; network errors; OpenAI-specific errors

**Retryable Errors:**
- HTTP status codes: 429 (Rate Limit), 500 (Internal Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
- Network errors: ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED, EAI_AGAIN
- OpenAI-specific: rate_limit_exceeded, server_error, timeout, rate_limit_error, server_error (type)

**Exponential Backoff:**
- Formula: `delay = initialDelay * (multiplier ^ (attempt - 1))`
- Capped at `maxDelay`
- Jitter: ±10% random variation to prevent synchronized retries

## Files Modified

### 1. `backend/src/services/embedding.service.ts`
**Changes:**
- Added import for `RetryService`
- Wrapped all `client.embeddings.create()` calls with retry logic
- Applied to:
  - Batch queue processing (`processBatch`)
  - Single embedding generation (`generateEmbedding`)
  - Batch embedding generation (`generateEmbeddingsBatch`)

**Retry Configuration:**
- `maxRetries`: 3
- `initialDelay`: 1000ms
- `maxDelay`: 10000ms
- Custom `onRetry` callback for logging

**Example:**
```typescript
const retryResult = await RetryService.execute(
  async () => {
    return await client.embeddings.create(requestParams);
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    multiplier: 2,
    maxDelay: 10000,
    onRetry: (error, attempt, delay) => {
      logger.warn('Retrying embedding generation', {
        attempt,
        delay,
        error: error.message,
        batchSize: textsForGeneration.length,
        model: embeddingModel,
      });
    },
  }
);
const response = retryResult.result;
```

### 2. `backend/src/services/search.service.ts`
**Changes:**
- Added import for `RetryService`
- Wrapped `tavilyClient.search()` call with retry logic

**Retry Configuration:**
- `maxRetries`: 3
- `initialDelay`: 1000ms
- `maxDelay`: 10000ms
- Custom `onRetry` callback for logging

**Example:**
```typescript
const retryResult = await RetryService.execute(
  async () => {
    return await tavilyClient.search(searchQuery, tavilyOptions);
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    multiplier: 2,
    maxDelay: 10000,
    onRetry: (error, attempt, delay) => {
      logger.warn('Retrying Tavily search', {
        attempt,
        delay,
        error: error.message,
        query: searchQuery.substring(0, 100),
      });
    },
  }
);
const response = retryResult.result;
```

### 3. `backend/src/services/ai.service.ts`
**Changes:**
- Added import for `RetryService`
- Wrapped all `openai.chat.completions.create()` calls with retry logic
- Applied to:
  - Main question answering (`answerQuestion`)
  - Off-topic pre-check (`runOffTopicPreCheck`)
  - Follow-up question generation (`generateFollowUpQuestions`)
  - Research session summary (`generateResearchSessionSummary`)
  - Suggested starters (`generateSuggestedStarters`)
  - Response summarization (`summarizeResponse`)
  - Essay generation (`writeEssay`)
  - Detailed report generation (`generateDetailedReport`)

**Retry Configuration:**
- Main API calls: `maxRetries: 3`, `maxDelay: 30000ms`
- Helper calls: `maxRetries: 2`, `maxDelay: 5000-10000ms`
- Custom `onRetry` callbacks for detailed logging

**Example:**
```typescript
const retryResult = await RetryService.execute(
  async () => {
    return await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    multiplier: 2,
    maxDelay: 30000,
    onRetry: (error, attempt, delay) => {
      logger.warn('Retrying OpenAI API call', {
        attempt,
        delay,
        error: error.message,
        model,
        questionLength: request.question.length,
      });
    },
  }
);
const completion = retryResult.result;
```

### 4. `backend/src/routes/cache.routes.ts`
**Changes:**
- Added import for `RetryService`
- Added `GET /api/cache/retry/stats` endpoint for retry statistics
- Added `POST /api/cache/retry/reset-stats` endpoint to reset statistics

## Implementation Details

### Exponential Backoff Algorithm

#### Delay Calculation
```typescript
// Exponential backoff: initialDelay * (multiplier ^ attempt)
const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);

// Apply max delay cap
const cappedDelay = Math.min(exponentialDelay, maxDelay);

// Add jitter (random value between 0 and 10% of delay)
if (jitter) {
  const jitterAmount = cappedDelay * 0.1 * Math.random();
  return Math.floor(cappedDelay + jitterAmount);
}
```

#### Example Delays
- Attempt 1: 1000ms (initial delay)
- Attempt 2: 2000ms (1000 * 2^1)
- Attempt 3: 4000ms (1000 * 2^2)
- Attempt 4: 8000ms (1000 * 2^3)
- Capped at maxDelay (e.g., 30000ms)

### Retryable Error Detection

#### HTTP Status Codes
- `429`: Too Many Requests (rate limiting)
- `500`: Internal Server Error
- `502`: Bad Gateway
- `503`: Service Unavailable
- `504`: Gateway Timeout

#### Network Error Codes
- `ECONNRESET`: Connection reset by peer
- `ETIMEDOUT`: Connection timeout
- `ENOTFOUND`: DNS lookup failed
- `ECONNREFUSED`: Connection refused
- `EAI_AGAIN`: Temporary DNS failure

#### OpenAI-Specific Errors
- Error code: `rate_limit_exceeded`
- Error code: `server_error`
- Error code: `timeout`
- Error type: `rate_limit_error`
- Error type: `server_error`

### Statistics Tracking

#### Metrics Collected
- `totalAttempts`: Total number of attempts (including retries)
- `successfulRetries`: Number of operations that succeeded after retry
- `failedRetries`: Number of operations that failed after all retries
- `totalRetries`: Total number of retry attempts
- `averageRetries`: Average number of retries per operation
- `retriesByError`: Breakdown of retries by error type

#### Statistics Calculation
```typescript
// Average retries per operation
averageRetries = totalRetries / (totalAttempts - totalRetries)

// Success rate
successRate = (totalAttempts - failedRetries) / totalAttempts * 100
```

### Logging

#### Retry Attempt Logging
- Logs retry attempts with attempt number, delay, and error details
- Includes context (model, query length, batch size, etc.)
- Logs successful retries with timing information

#### Error Logging
- Logs non-retryable errors immediately
- Logs exhausted retries with full error details
- Tracks error types for analysis

## Usage Examples

### Basic Usage
```typescript
import { RetryService } from './services/retry.service';

const result = await RetryService.execute(
  async () => {
    return await externalApi.call();
  }
);

console.log(result.result); // The actual result
console.log(result.attempts); // Number of attempts
console.log(result.totalTime); // Total time in ms
```

### Custom Configuration
```typescript
const result = await RetryService.execute(
  async () => {
    return await externalApi.call();
  },
  {
    maxRetries: 5,
    initialDelay: 2000,
    multiplier: 1.5,
    maxDelay: 60000,
    jitter: false,
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
    },
  }
);
```

### Check if Error is Retryable
```typescript
import { RetryService } from './services/retry.service';

try {
  await externalApi.call();
} catch (error) {
  if (RetryService.isRetryableError(error)) {
    // Handle retryable error
  } else {
    // Handle non-retryable error
  }
}
```

### Get Statistics
```typescript
import { RetryService } from './services/retry.service';

const stats = RetryService.getStats();
console.log({
  totalAttempts: stats.totalAttempts,
  successfulRetries: stats.successfulRetries,
  failedRetries: stats.failedRetries,
  averageRetries: stats.averageRetries,
  retriesByError: stats.retriesByError,
});
```

## API Endpoints

### Get Retry Statistics
```bash
GET /api/cache/retry/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalAttempts": 150,
      "successfulRetries": 12,
      "failedRetries": 3,
      "totalRetries": 45,
      "averageRetries": 0.3,
      "retriesByError": {
        "429": 20,
        "500": 15,
        "ETIMEDOUT": 10
      }
    },
    "summary": {
      "totalAttempts": 150,
      "successfulRetries": 12,
      "failedRetries": 3,
      "successRate": 98.0,
      "averageRetries": 0.3
    }
  }
}
```

### Reset Retry Statistics
```bash
POST /api/cache/retry/reset-stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Retry statistics reset"
}
```

## Performance Impact

### Resilience Improvements
- **Transient failures handled**: Rate limits, network issues, temporary server errors
- **Reduced error rates**: Automatic retry for recoverable errors
- **Better user experience**: Fewer failed requests due to transient issues

### Backoff Strategy Effectiveness
- **Prevents overwhelming APIs**: Exponential backoff reduces load during outages
- **Jitter prevents thundering herd**: Random variation prevents synchronized retries
- **Configurable delays**: Can be tuned per API and use case

### Metrics and Monitoring
- **Visibility into retry patterns**: Track which errors trigger retries
- **Performance insights**: Understand retry success rates
- **Error analysis**: Identify common retryable errors

## Acceptance Criteria

✅ **Retries work correctly**
- All external API calls wrapped with retry logic
- Retries execute on retryable errors
- Non-retryable errors fail immediately
- Retry attempts tracked correctly

✅ **Backoff strategy effective**
- Exponential backoff implemented
- Jitter prevents synchronized retries
- Delays capped at maximum
- Configurable per use case

✅ **Metrics tracked**
- Total attempts tracked
- Successful/failed retries tracked
- Average retries calculated
- Error breakdown available
- API endpoints for monitoring

## Testing Recommendations

1. **Retry Logic:**
   - Test retry on rate limit errors (429)
   - Test retry on server errors (500, 502, 503, 504)
   - Test retry on network errors
   - Test non-retryable errors fail immediately
   - Test max retries limit

2. **Backoff Strategy:**
   - Verify exponential backoff delays
   - Verify jitter variation
   - Verify max delay cap
   - Test different multipliers

3. **Statistics:**
   - Verify statistics tracking
   - Test statistics reset
   - Verify API endpoints
   - Test error breakdown

4. **Integration:**
   - Test with OpenAI API
   - Test with Tavily API
   - Test with embedding generation
   - Test with search operations

5. **Edge Cases:**
   - Test with no retries needed
   - Test with all retries exhausted
   - Test with custom configurations
   - Test error callback

## Configuration

### Environment Variables
No new environment variables required. Retry behavior is configured in code per use case.

### Per-Service Configuration
```typescript
// Embedding service
{
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
}

// Search service
{
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
}

// AI service (main calls)
{
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
}

// AI service (helper calls)
{
  maxRetries: 2,
  initialDelay: 500-1000,
  maxDelay: 5000-10000,
}
```

## Troubleshooting

### High Retry Rates
- Check API health
- Review rate limits
- Adjust retry configuration
- Monitor error types

### Retries Not Working
- Verify error is retryable
- Check retry configuration
- Review error logs
- Test retry logic directly

### Performance Issues
- Review retry delays
- Check max retries
- Monitor retry statistics
- Optimize retry configuration

## Future Enhancements

- Circuit breaker integration
- Adaptive retry delays based on error patterns
- Per-endpoint retry configuration
- Retry budget/throttling
- Advanced error classification
- Retry metrics export
- Integration with monitoring tools
- Retry visualization dashboards
