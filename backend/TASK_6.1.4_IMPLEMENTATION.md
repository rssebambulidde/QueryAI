# Task 6.1.4: Implement Cache Invalidation Strategy

## Overview
Implemented a comprehensive cache invalidation system with triggers, versioning, and API endpoints for managing cache lifecycle and preventing stale data.

## Implementation Date
January 26, 2026

## Objectives
- Define cache invalidation triggers (document updates, time-based)
- Implement invalidation service
- Add cache versioning
- Create invalidation API endpoints
- Add manual invalidation tools

## Files Created

### 1. `backend/src/services/cache-invalidation.service.ts`
**Purpose:** Centralized cache invalidation service with triggers and versioning

**Key Features:**
- Cache versioning system
- Multiple invalidation triggers (document, topic, user, time, manual)
- Invalidation history logging
- Granular control over what to invalidate (RAG, embeddings, search)
- Pattern-based invalidation

**Methods:**
- `getCacheVersion()`: Get current cache version
- `incrementCacheVersion()`: Increment version (invalidates all versioned caches)
- `invalidateDocumentCache()`: Invalidate cache for specific documents
- `invalidateTopicCache()`: Invalidate cache for a topic
- `invalidateUserCache()`: Invalidate all cache for a user
- `invalidateByTime()`: Time-based cache invalidation
- `invalidateManually()`: Manual invalidation with custom options
- `clearAllCaches()`: Clear all caches (admin operation)
- `getInvalidationHistory()`: Get invalidation history

**Interfaces:**
- `InvalidationTrigger`: Tracks invalidation events
- `CacheVersion`: Cache version information
- `InvalidationOptions`: Options for invalidation operations
- `InvalidationResult`: Result of invalidation operations

### 2. `backend/src/routes/cache.routes.ts`
**Purpose:** API endpoints for cache management and invalidation

**Endpoints:**
- `GET /api/cache/stats`: Get cache statistics
- `GET /api/cache/version`: Get current cache version
- `POST /api/cache/invalidate/document`: Invalidate cache for documents
- `POST /api/cache/invalidate/topic`: Invalidate cache for a topic
- `POST /api/cache/invalidate/user`: Invalidate all cache for user
- `POST /api/cache/invalidate/time`: Time-based invalidation
- `POST /api/cache/invalidate/manual`: Manual invalidation with custom options
- `POST /api/cache/clear`: Clear all caches (admin)
- `GET /api/cache/history`: Get invalidation history
- `GET /api/cache/rag/stats`: Get RAG cache statistics
- `POST /api/cache/rag/invalidate`: Invalidate RAG cache

## Files Modified

### 1. `backend/src/server.ts`
**Changes:**
- Added import for `cacheRoutes`
- Registered cache routes at `/api/cache`

### 2. `backend/src/routes/documents.routes.ts`
**Changes:**
- Added import for `CacheInvalidationService`
- Added cache invalidation after document deletion
- Added cache invalidation after document embedding/processing
- Invalidation is non-blocking (doesn't fail operations if cache invalidation fails)

**Invalidation Triggers:**
- Document deletion (both by ID and by path)
- Document embedding completion (automatic and manual)
- Document processing completion

### 3. `backend/src/routes/topics.routes.ts`
**Changes:**
- Added import for `CacheInvalidationService`
- Added cache invalidation after topic update
- Added cache invalidation after topic deletion
- Invalidation is non-blocking

**Invalidation Triggers:**
- Topic update (name, description, scopeConfig changes)
- Topic deletion

## Implementation Details

### Cache Versioning

**Version Format:**
```
v{timestamp}
```
Example: `v1706284800000`

**Version Storage:**
- Stored in Redis with key: `system:cache:version`
- TTL: 1 year (versions don't expire)
- Includes `createdAt` and `updatedAt` timestamps

**Version Increment:**
- Called when all caches need to be invalidated
- Creates new version timestamp
- Useful for schema changes or major updates

### Invalidation Triggers

#### 1. Document Updates
**Triggered When:**
- Document is deleted
- Document is embedded/processed
- Document metadata is updated (future enhancement)

**Invalidates:**
- RAG context cache (default: true)
- Embedding cache (optional)
- Search cache (optional)

**Pattern:**
- User-specific: `*|{userId}|*|{documentId}|*`
- Topic-specific: `*|{userId}|{topicId}|*|{documentId}|*`

#### 2. Topic Updates
**Triggered When:**
- Topic is updated (name, description, scopeConfig)
- Topic is deleted

**Invalidates:**
- RAG context cache (default: true)

**Pattern:**
- `*|{userId}|{topicId}|*`

#### 3. User Updates
**Triggered When:**
- User data changes (manual trigger)

**Invalidates:**
- All user caches (RAG, embeddings, search)

**Pattern:**
- `*|{userId}|*`

#### 4. Time-Based Invalidation
**Triggered When:**
- Scheduled job or manual trigger
- Invalidates caches older than specified age

**Invalidates:**
- Caches based on TTL (handled by Redis automatically)
- Can be used for proactive cleanup

#### 5. Manual Invalidation
**Triggered When:**
- Admin or user manually requests invalidation
- Custom patterns and cache types

**Options:**
- `cacheType`: 'rag' | 'embedding' | 'search' | 'all'
- `pattern`: Custom Redis pattern
- `invalidateRAG`, `invalidateEmbeddings`, `invalidateSearch`: Boolean flags

### Invalidation Flow

1. **Trigger Detection**: Operation (delete, update, etc.) detected
2. **Invalidation Service**: Call appropriate invalidation method
3. **Pattern Matching**: Find matching cache keys using Redis SCAN
4. **Key Deletion**: Delete matching keys from Redis
5. **Logging**: Log invalidation event with details
6. **Statistics**: Update invalidation statistics

### Invalidation Logging

**Log Entry Structure:**
```typescript
{
  trigger: {
    type: 'document' | 'topic' | 'user' | 'time' | 'manual',
    userId: string,
    topicId?: string,
    documentIds?: string[],
    reason?: string,
    timestamp: number
  },
  result: {
    success: boolean,
    invalidated: {
      rag: number,
      embeddings: number,
      search: number,
      total: number
    },
    errors: string[]
  }
}
```

**Log Storage:**
- Key: `system:invalidation:log:{timestamp}`
- TTL: 7 days
- Retrievable via `getInvalidationHistory()`

## Usage Examples

### API Usage

#### Get Cache Statistics
```bash
GET /api/cache/stats
Authorization: Bearer {token}
```

#### Invalidate Document Cache
```bash
POST /api/cache/invalidate/document
Authorization: Bearer {token}
Content-Type: application/json

{
  "documentIds": ["doc-1", "doc-2"],
  "options": {
    "invalidateRAG": true,
    "invalidateEmbeddings": false,
    "invalidateSearch": false,
    "reason": "Document updated"
  }
}
```

#### Invalidate Topic Cache
```bash
POST /api/cache/invalidate/topic
Authorization: Bearer {token}
Content-Type: application/json

{
  "topicId": "topic-123",
  "options": {
    "invalidateRAG": true,
    "reason": "Topic updated"
  }
}
```

#### Manual Invalidation
```bash
POST /api/cache/invalidate/manual
Authorization: Bearer {token}
Content-Type: application/json

{
  "cacheType": "rag",
  "pattern": "*|user-123|*",
  "options": {
    "invalidateRAG": true,
    "reason": "Manual cleanup"
  }
}
```

#### Get Invalidation History
```bash
GET /api/cache/history?limit=50
Authorization: Bearer {token}
```

### Programmatic Usage

```typescript
import { CacheInvalidationService } from './services/cache-invalidation.service';

// Invalidate document cache
const result = await CacheInvalidationService.invalidateDocumentCache(
  userId,
  ['doc-1', 'doc-2'],
  {
    invalidateRAG: true,
    invalidateEmbeddings: true,
    reason: 'Documents updated',
  }
);

// Invalidate topic cache
await CacheInvalidationService.invalidateTopicCache(
  userId,
  topicId,
  {
    invalidateRAG: true,
    reason: 'Topic updated',
  }
);

// Get cache version
const version = await CacheInvalidationService.getCacheVersion();

// Increment cache version (invalidates all)
const newVersion = await CacheInvalidationService.incrementCacheVersion();

// Get invalidation history
const history = await CacheInvalidationService.getInvalidationHistory(50);
```

## Integration Points

### Document Service Integration
- **Delete Operations**: Cache invalidated after document deletion
- **Embedding Operations**: Cache invalidated after successful embedding
- **Processing Operations**: Cache invalidated after document processing

### Topic Service Integration
- **Update Operations**: Cache invalidated after topic update
- **Delete Operations**: Cache invalidated after topic deletion

### Automatic Triggers
- Document deletion → RAG cache invalidation
- Document embedding → RAG cache invalidation
- Topic update → RAG cache invalidation
- Topic deletion → RAG cache invalidation

## Acceptance Criteria

✅ **Cache invalidated appropriately**
- Document updates trigger cache invalidation
- Topic updates trigger cache invalidation
- Time-based invalidation supported
- Manual invalidation available

✅ **Stale data prevented**
- Cache versioning ensures consistency
- Invalidation triggers prevent stale data
- Pattern matching ensures accurate invalidation
- Logging enables audit trail

✅ **Manual control available**
- API endpoints for manual invalidation
- Granular control (RAG, embeddings, search)
- Custom pattern support
- Clear all caches option

## Testing Recommendations

1. **Invalidation Triggers:**
   - Test document deletion invalidation
   - Test document embedding invalidation
   - Test topic update invalidation
   - Test topic deletion invalidation

2. **API Endpoints:**
   - Test all invalidation endpoints
   - Test authentication/authorization
   - Test error handling
   - Test response formats

3. **Versioning:**
   - Test version retrieval
   - Test version increment
   - Test version persistence

4. **Pattern Matching:**
   - Test user-specific patterns
   - Test topic-specific patterns
   - Test document-specific patterns
   - Test custom patterns

5. **History:**
   - Test invalidation logging
   - Test history retrieval
   - Test history limits

6. **Edge Cases:**
   - Empty cache invalidation
   - Non-existent keys
   - Redis connection failures
   - Large-scale invalidation

## Monitoring

### Invalidation Statistics
```typescript
const history = await CacheInvalidationService.getInvalidationHistory(50);
console.log({
  totalInvalidations: history.length,
  byType: {
    document: history.filter(h => h.trigger.type === 'document').length,
    topic: history.filter(h => h.trigger.type === 'topic').length,
    user: history.filter(h => h.trigger.type === 'user').length,
    time: history.filter(h => h.trigger.type === 'time').length,
    manual: history.filter(h => h.trigger.type === 'manual').length,
  }
});
```

### Cache Version
```typescript
const version = await CacheInvalidationService.getCacheVersion();
console.log({
  currentVersion: version?.version,
  createdAt: version?.createdAt,
  updatedAt: version?.updatedAt,
});
```

## Troubleshooting

### Invalidation Not Working
- Check Redis connection
- Verify pattern matching
- Check invalidation logs
- Verify user/topic/document IDs

### Performance Issues
- Monitor invalidation time
- Check number of keys matched
- Optimize patterns
- Consider batch invalidation

### Stale Data
- Check invalidation triggers
- Verify cache version
- Check TTL settings
- Review invalidation history

## Future Enhancements

- Event-driven invalidation (webhooks)
- Scheduled invalidation jobs
- Invalidation analytics
- Smart invalidation (only invalidate affected caches)
- Cache warming after invalidation
- Invalidation batching for performance
- Invalidation policies (per user/topic)
- Cache dependency tracking
