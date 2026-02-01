# Task 7.1.3: Implement Graceful Degradation

## Overview
Implemented graceful degradation system to handle service failures and provide partial results when possible, ensuring users are informed about degraded service states.

## Implementation Date
January 26, 2026

## Objectives
- Define degradation strategies for each service
- Implement fallback mechanisms
- Add degradation service
- Return partial results when possible
- Inform users of degraded service

## Files Created

### 1. `backend/src/services/degradation.service.ts`
**Purpose:** Centralized service for managing degradation states and fallback strategies

**Key Features:**
- Service degradation tracking
- Degradation level classification (NONE, PARTIAL, SEVERE, CRITICAL)
- Circuit breaker integration
- Fallback availability detection
- Partial result capability detection
- Degradation message generation
- Statistics tracking

**Degradation Levels:**
- `NONE`: No degradation, all services operational
- `PARTIAL`: Some services degraded, partial functionality available
- `SEVERE`: Most services degraded, limited functionality
- `CRITICAL`: Critical services down, minimal functionality

**Service Types:**
- `EMBEDDING`: OpenAI embedding service
- `SEARCH`: Tavily search service
- `PINECONE`: Pinecone vector database
- `OPENAI`: OpenAI chat completion service
- `TAVILY`: Tavily search service (alias)

**Methods:**
- `isServiceDegraded()`: Check if a service is degraded
- `getServiceDegradationLevel()`: Get degradation level for a service
- `updateServiceStatus()`: Update service degradation status
- `checkCircuitBreakerStatus()`: Check circuit breaker status for a service
- `getOverallStatus()`: Get overall degradation status
- `handleServiceError()`: Handle service error and determine degradation
- `createFallbackResult()`: Create fallback result with degradation info
- `getStatistics()`: Get degradation statistics

## Files Modified

### 1. `backend/src/services/rag.service.ts`
**Changes:**
- Added import for `DegradationService`
- Extended `RAGContext` interface to include degradation information
- Added degradation handling in `retrieveDocumentContext`:
  - Fallback to keyword search if embedding fails
  - Fallback to keyword search if Pinecone search fails
- Added degradation handling in `retrieveWebSearch`:
  - Graceful error handling for search failures
- Updated `retrieveContext` to use `Promise.allSettled` for parallel retrieval:
  - Handles partial failures gracefully
  - Returns partial results when some services fail
- Added degradation status to returned context

**Fallback Strategies:**
1. **Embedding Failure**: Falls back to keyword search if enabled
2. **Pinecone Failure**: Falls back to keyword search if enabled
3. **Web Search Failure**: Returns empty results, continues with document search
4. **Partial Results**: Returns available results even if some services fail

**Example:**
```typescript
// Embedding failure fallback
try {
  queryEmbedding = await EmbeddingService.generateEmbedding(expandedQuery);
} catch (embeddingError: any) {
  DegradationService.handleServiceError(ServiceType.EMBEDDING, embeddingError);
  
  // Fallback: if embedding fails and keyword search is enabled, return empty
  // The caller will use keyword search as fallback
  if (options.enableKeywordSearch) {
    logger.warn('Embedding generation failed, falling back to keyword search');
    return [];
  }
  throw embeddingError;
}
```

### 2. `backend/src/services/ai.service.ts`
**Changes:**
- Added imports for `DegradationService` and `CircuitBreakerService`
- Extended `QuestionResponse` interface to include degradation information
- Added degradation tracking from RAG context
- Added OpenAI API error handling with fallback:
  - If OpenAI fails but RAG context is available, returns partial response
  - Includes available sources in degraded response
- Added degradation information to response

**Fallback Strategies:**
1. **OpenAI API Failure**: Returns partial response with available sources if RAG context exists
2. **RAG Context Degradation**: Passes through degradation information from RAG service
3. **Circuit Breaker Integration**: Checks circuit breaker status for OpenAI

**Example:**
```typescript
// OpenAI API failure with fallback
try {
  completion = await RetryService.execute(/* ... */);
} catch (openaiError: any) {
  DegradationService.handleServiceError(ServiceType.OPENAI, openaiError);
  
  // If we have partial context, we can still provide a degraded response
  if (ragContext && sources && sources.length > 0) {
    return {
      answer: `I apologize, but I'm experiencing technical difficulties...`,
      model: model,
      sources,
      degraded: true,
      degradationLevel: DegradationLevel.SEVERE,
      degradationMessage: 'AI service is currently unavailable',
      partial: true,
    };
  }
  throw openaiError;
}
```

### 3. `backend/src/routes/cache.routes.ts`
**Changes:**
- Added import for `DegradationService`
- Added `GET /api/cache/degradation/stats` endpoint for degradation statistics
- Added `POST /api/cache/degradation/reset` endpoint to reset degradation status

## Implementation Details

### Degradation Detection

#### Service Error Handling
- Errors are analyzed to determine degradation level
- Rate limits (429) → PARTIAL degradation
- Server errors (500+) → SEVERE degradation
- Connection errors → SEVERE degradation
- Circuit breaker OPEN → SEVERE degradation

#### Circuit Breaker Integration
- Checks circuit breaker state for each service
- Automatically updates degradation status based on circuit state
- OPEN circuit → SEVERE degradation
- HALF_OPEN circuit → PARTIAL degradation
- CLOSED circuit → No degradation

### Fallback Mechanisms

#### Embedding Service
- **Primary**: OpenAI embedding generation
- **Fallback**: Keyword search (BM25) if embedding fails
- **Partial**: Returns empty array, allows keyword search to proceed

#### Pinecone Service
- **Primary**: Semantic vector search
- **Fallback**: Keyword search (BM25) if Pinecone fails
- **Partial**: Returns empty array, allows keyword search to proceed

#### Web Search Service
- **Primary**: Tavily web search
- **Fallback**: Returns empty results, continues with document search
- **Partial**: Document search can still provide results

#### OpenAI Service
- **Primary**: OpenAI chat completion
- **Fallback**: Returns partial response with available sources if RAG context exists
- **Partial**: Includes available sources in degraded response

### Partial Results

#### RAG Context
- Returns available document chunks even if web search fails
- Returns available web results even if document search fails
- Combines results from multiple sources when available
- Marks context as partial when some services fail

#### AI Response
- Returns answer with available sources even if some services fail
- Includes degradation message in response
- Marks response as partial when degradation occurs

### User Notifications

#### Degradation Messages
- **PARTIAL**: "Some services are experiencing issues. Partial functionality available."
- **SEVERE**: "Multiple services are unavailable. Limited functionality available."
- **CRITICAL**: "Critical services are unavailable. Minimal functionality available."

#### Response Fields
- `degraded`: Boolean indicating if service is degraded
- `degradationLevel`: Level of degradation (PARTIAL, SEVERE, CRITICAL)
- `degradationMessage`: Human-readable message about degradation
- `partial`: Boolean indicating if results are partial

## Usage Examples

### Check Degradation Status
```typescript
import { DegradationService } from './services/degradation.service';

const status = DegradationService.getOverallStatus();
console.log({
  level: status.level,
  affectedServices: status.affectedServices,
  message: status.message,
  canProvidePartialResults: status.canProvidePartialResults,
});
```

### Handle Service Error
```typescript
try {
  await externalService.call();
} catch (error) {
  const level = DegradationService.handleServiceError(
    ServiceType.EMBEDDING,
    error
  );
  console.log('Degradation level:', level);
}
```

### Create Fallback Result
```typescript
const result = DegradationService.createFallbackResult(
  partialData,
  true, // degraded
  [ServiceType.EMBEDDING],
  'Embedding service is unavailable',
  false, // fromCache
  true // partial
);
```

### Get Statistics
```typescript
const stats = DegradationService.getStatistics();
console.log({
  totalServices: stats.totalServices,
  degradedServices: stats.degradedServices,
  services: stats.services,
  overallStatus: stats.overallStatus,
});
```

## API Endpoints

### Get Degradation Statistics
```bash
GET /api/cache/degradation/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalServices": 5,
      "degradedServices": 2,
      "services": {
        "embedding": "severe",
        "search": "none",
        "pinecone": "none",
        "openai": "none",
        "tavily": "none"
      },
      "overallStatus": {
        "level": "severe",
        "affectedServices": ["embedding"],
        "message": "Multiple services are unavailable (EMBEDDING). Limited functionality available.",
        "canProvidePartialResults": true,
        "fallbackAvailable": true
      }
    },
    "overallStatus": {
      "level": "severe",
      "affectedServices": ["embedding"],
      "message": "Multiple services are unavailable (EMBEDDING). Limited functionality available.",
      "canProvidePartialResults": true,
      "fallbackAvailable": true
    }
  }
}
```

### Reset Degradation Status
```bash
POST /api/cache/degradation/reset
Authorization: Bearer {token}
Content-Type: application/json

{
  "service": "embedding" // Optional: reset specific service, omit to reset all
}
```

**Response:**
```json
{
  "success": true,
  "message": "Degradation status reset for embedding"
}
```

## Response Format

### RAG Context with Degradation
```typescript
{
  documentContexts: DocumentContext[],
  webSearchResults: WebResult[],
  degraded?: boolean,
  degradationLevel?: DegradationLevel,
  affectedServices?: ServiceType[],
  degradationMessage?: string,
  partial?: boolean
}
```

### AI Response with Degradation
```typescript
{
  answer: string,
  model: string,
  sources?: Source[],
  citations?: {...},
  followUpQuestions?: string[],
  usage: {...},
  degraded?: boolean,
  degradationLevel?: DegradationLevel,
  degradationMessage?: string,
  partial?: boolean
}
```

## Acceptance Criteria

✅ **System degrades gracefully**
- Services handle failures without crashing
- Partial results returned when possible
- Fallback mechanisms activated automatically
- System continues operating with reduced functionality

✅ **Partial results returned**
- Document search results returned even if web search fails
- Web search results returned even if document search fails
- Keyword search used as fallback for semantic search
- Available sources included in degraded responses

✅ **Users informed**
- Degradation information included in responses
- Clear messages about service status
- Partial results clearly marked
- Degradation level communicated

## Testing Recommendations

1. **Degradation Detection:**
   - Test service error handling
   - Test circuit breaker integration
   - Test degradation level classification
   - Test overall status calculation

2. **Fallback Mechanisms:**
   - Test embedding failure → keyword search fallback
   - Test Pinecone failure → keyword search fallback
   - Test web search failure → document search continues
   - Test OpenAI failure → partial response with sources

3. **Partial Results:**
   - Test partial document results
   - Test partial web results
   - Test combined partial results
   - Test degraded response format

4. **User Notifications:**
   - Test degradation messages
   - Test response fields
   - Test API endpoints
   - Test statistics tracking

5. **Integration:**
   - Test with RAG service
   - Test with AI service
   - Test with circuit breakers
   - Test with retry logic

## Configuration

### Degradation Levels
- `NONE`: All services operational
- `PARTIAL`: Some services degraded (rate limits, temporary issues)
- `SEVERE`: Multiple services degraded (server errors, circuit open)
- `CRITICAL`: Critical services down (complete failure)

### Service Types
- `EMBEDDING`: OpenAI embedding service
- `SEARCH`: Tavily search service
- `PINECONE`: Pinecone vector database
- `OPENAI`: OpenAI chat completion
- `TAVILY`: Tavily search (alias)

## Troubleshooting

### Services Not Degrading
- Check error handling
- Verify circuit breaker integration
- Review degradation detection logic
- Check service error types

### Partial Results Not Returned
- Verify fallback mechanisms
- Check service availability
- Review error handling
- Test fallback paths

### Users Not Informed
- Check response format
- Verify degradation fields
- Review message generation
- Test API endpoints

## Future Enhancements

- Automatic recovery detection
- Degradation history tracking
- Alerting on degradation
- Degradation metrics export
- Integration with monitoring tools
- Degradation dashboards
- Adaptive fallback strategies
- Service health scoring
- Predictive degradation detection
- Degradation impact analysis
