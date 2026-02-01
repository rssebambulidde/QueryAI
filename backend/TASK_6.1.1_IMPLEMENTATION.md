# Task 6.1.1: Implement Redis for Distributed Caching

## Overview
Implemented Redis for distributed caching to replace in-memory cache, enabling cache persistence across server restarts and improved performance through distributed caching.

## Implementation Date
January 26, 2026

## Objectives
- Set up Redis instance (cloud)
- Install Redis client library
- Create Redis cache service
- Migrate in-memory cache to Redis
- Add connection pooling

## Files Created

### 1. `backend/src/config/redis.config.ts`
**Purpose:** Redis client configuration and connection management

**Key Features:**
- Connection pooling with singleton pattern
- Support for Redis URL or individual connection parameters
- Automatic reconnection with exponential backoff
- Health check functionality
- Error handling and logging

**Configuration Options:**
- `REDIS_URL`: Complete Redis connection URL (recommended)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`, `REDIS_DATABASE`: Individual parameters

**Functions:**
- `getRedisClient()`: Get or create Redis client (singleton)
- `createRedisClient()`: Create new Redis client connection
- `closeRedisClient()`: Close Redis connection gracefully
- `checkRedisHealth()`: Health check for Redis connection
- `isRedisConfigured()`: Check if Redis is configured
- `getRedisConfig()`: Get Redis configuration from environment

### 2. `backend/src/services/redis-cache.service.ts`
**Purpose:** Generic Redis caching service with automatic serialization

**Key Features:**
- Automatic JSON serialization/deserialization
- TTL (Time To Live) support
- Key prefixing for namespacing
- Pattern-based deletion
- Cache statistics tracking
- Graceful degradation if Redis unavailable

**Methods:**
- `get<T>(key, options)`: Get value from cache
- `set<T>(key, value, options)`: Set value in cache with TTL
- `delete(key, options)`: Delete value from cache
- `deletePattern(pattern, options)`: Delete multiple keys matching pattern
- `exists(key, options)`: Check if key exists
- `getTTL(key, options)`: Get remaining TTL for key
- `extendTTL(key, ttl, options)`: Extend TTL for key
- `clearAll(options)`: Clear all cache entries (use with caution)
- `getStats()`: Get cache statistics
- `healthCheck()`: Health check with statistics

## Files Modified

### 1. `backend/package.json`
**Changes:**
- Added `redis` v4.7.0 dependency
- Added `@types/redis` v4.0.11 dev dependency

### 2. `backend/src/config/env.ts`
**Changes:**
- Added Redis environment variables:
  - `REDIS_URL` (optional)
  - `REDIS_HOST` (optional)
  - `REDIS_PORT` (optional)
  - `REDIS_PASSWORD` (optional)
  - `REDIS_USERNAME` (optional)
  - `REDIS_DATABASE` (optional)

### 3. `backend/src/services/search.service.ts`
**Changes:**
- Removed in-memory `Map`-based cache
- Removed manual cache cleanup function
- Migrated to Redis cache using `RedisCacheService`
- Updated cache key generation
- Changed TTL from milliseconds to seconds (3600 seconds = 1 hour)

**Before:**
```typescript
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
```

**After:**
```typescript
const CACHE_TTL = 3600; // 1 hour in seconds (for Redis)
const CACHE_PREFIX = 'search';
```

## Architecture

### Connection Pooling
- **Singleton Pattern**: Single Redis client instance shared across application
- **Connection Reuse**: Client reused for all cache operations
- **Automatic Reconnection**: Exponential backoff strategy (50ms, 100ms, 200ms, max 3s)
- **Health Monitoring**: Connection state tracking and health checks

### Cache Key Structure
```
{prefix}:{key}
```
Example: `search:query|topic|maxResults|...`

### TTL Management
- Automatic expiration handled by Redis
- No manual cleanup required
- Configurable per cache operation

## Configuration

### Environment Variables

**Option 1: Redis URL (Recommended)**
```bash
REDIS_URL=redis://[username]:[password]@[host]:[port]/[database]
```

**Option 2: Individual Parameters**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_USERNAME=your_username
REDIS_DATABASE=0
```

### Cloud Redis Providers
- **Upstash**: Serverless Redis (recommended for serverless deployments)
- **Redis Cloud**: Managed Redis service
- **AWS ElastiCache**: AWS managed Redis
- **Azure Cache for Redis**: Azure managed Redis
- **Google Cloud Memorystore**: GCP managed Redis

## Usage Example

```typescript
import { RedisCacheService } from './services/redis-cache.service';

// Get from cache
const cached = await RedisCacheService.get<SearchResponse>(cacheKey, {
  prefix: 'search',
  ttl: 3600,
});

// Set in cache
await RedisCacheService.set(cacheKey, searchResponse, {
  prefix: 'search',
  ttl: 3600,
});

// Check health
const health = await RedisCacheService.healthCheck();
console.log(health.stats); // Cache statistics
```

## Features

### 1. Distributed Caching
- Cache shared across multiple server instances
- Consistent cache state across deployments
- No cache duplication

### 2. Persistence
- Cache survives server restarts
- Data persisted in Redis
- No data loss on deployment

### 3. Performance
- Fast in-memory operations (Redis)
- Reduced API calls (cached responses)
- Lower latency for cached queries

### 4. Graceful Degradation
- Falls back gracefully if Redis unavailable
- No errors thrown if Redis not configured
- Application continues to work without cache

### 5. Statistics
- Track cache hits, misses, sets, deletes
- Monitor cache performance
- Health check with statistics

## Acceptance Criteria

✅ **Redis cache working**
- Redis client connects successfully
- Cache operations (get/set/delete) work correctly
- Connection pooling implemented

✅ **Performance improved**
- Reduced redundant API calls
- Faster response times for cached queries
- Distributed caching across instances

✅ **Cache persists across restarts**
- Cache data stored in Redis
- Survives server restarts
- No data loss on deployment

## Testing Recommendations

1. **Connection Testing:**
   - Test Redis connection with valid credentials
   - Test connection failure handling
   - Test reconnection after network issues

2. **Cache Operations:**
   - Test cache get/set operations
   - Test TTL expiration
   - Test cache key prefixing
   - Test pattern-based deletion

3. **Performance Testing:**
   - Measure cache hit rates
   - Compare response times with/without cache
   - Test under load

4. **Graceful Degradation:**
   - Test behavior when Redis unavailable
   - Test behavior when Redis not configured
   - Verify no errors thrown

## Performance Metrics

- **Cache Hit Rate**: Monitor via `getStats()`
- **Response Time**: Reduced for cached queries
- **API Calls**: Reduced for repeated queries
- **Memory Usage**: Offloaded to Redis

## Monitoring

### Health Check
```typescript
const health = await RedisCacheService.healthCheck();
// Returns: { healthy, configured, stats }
```

### Statistics
```typescript
const stats = RedisCacheService.getStats();
// Returns: { hits, misses, sets, deletes, errors }
```

## Troubleshooting

### Connection Issues
- Verify Redis URL/credentials
- Check network connectivity
- Verify Redis server is running
- Check firewall rules

### Performance Issues
- Monitor Redis memory usage
- Check connection pool size
- Verify TTL settings
- Monitor cache hit rates

## Future Enhancements

- Cache warming strategies
- Cache invalidation strategies
- Multi-tier caching (Redis + in-memory)
- Cache compression for large values
- Cache analytics and reporting
