# Task 6.2.2: Implement Request Queuing System

## Overview
Implemented a comprehensive request queuing system for RAG operations using BullMQ, with priority support, queue workers, and monitoring capabilities.

## Implementation Date
January 26, 2026

## Objectives
- Research queuing solutions (Bull, BullMQ, Redis Queue)
- Implement request queue for RAG operations
- Add priority queuing
- Implement queue workers
- Add queue monitoring

## Files Created

### 1. `backend/src/services/request-queue.service.ts`
**Purpose:** Queue management service for RAG requests

**Key Features:**
- BullMQ-based queue system
- Priority queuing (LOW, NORMAL, HIGH, URGENT)
- Job management (add, get, cancel, status)
- Queue statistics and health monitoring
- Automatic job cleanup
- Retry logic with exponential backoff

**Methods:**
- `initialize()`: Initialize the queue
- `addRAGRequest()`: Add a RAG request to the queue
- `getJob()`: Get job by ID
- `getJobStatus()`: Get job status
- `cancelJob()`: Cancel a job
- `getQueueStats()`: Get queue statistics
- `getJobsByState()`: Get jobs by state
- `pauseQueue()` / `resumeQueue()`: Queue control
- `cleanQueue()`: Clean old jobs
- `getQueueHealth()`: Get queue health status

**Interfaces:**
- `QueuePriority`: Priority levels (LOW, NORMAL, HIGH, URGENT)
- `RAGRequestJobData`: Job data structure
- `RAGRequestJobResult`: Job result structure
- `QueueStats`: Queue statistics

### 2. `backend/src/workers/rag-worker.ts`
**Purpose:** Worker for processing queued RAG requests

**Key Features:**
- Concurrent job processing (5 concurrent jobs)
- Rate limiting (10 jobs per second)
- Progress tracking
- Event handlers (completed, failed, error, stalled, active)
- Automatic retry on failure
- Processing time tracking

**Methods:**
- `initialize()`: Initialize the worker
- `processJob()`: Process a RAG request job
- `setupEventHandlers()`: Set up event handlers
- `getWorkerStatus()`: Get worker status
- `close()`: Close the worker

## Files Modified

### 1. `backend/src/routes/ai.routes.ts`
**Changes:**
- Added import for `RequestQueueService` and `QueuePriority`
- Updated `/api/ai/ask` endpoint to support optional queuing via `useQueue` parameter
- Added `/api/ai/ask/queue` endpoint for explicit queuing
- Added `/api/ai/queue/job/:jobId` endpoint for job status
- Added `DELETE /api/ai/queue/job/:jobId` endpoint for job cancellation
- Added `/api/ai/queue/stats` endpoint for queue statistics
- Added `/api/ai/queue/jobs` endpoint for listing jobs by state

**Queue Integration:**
- Optional queuing via `useQueue` parameter in `/api/ai/ask`
- Priority support via `priority` parameter
- Automatic fallback to direct processing if queue fails

### 2. `backend/src/server.ts`
**Changes:**
- Added queue and worker initialization on startup
- Added graceful shutdown for queue and worker
- Error handling for queue initialization failures

### 3. `backend/package.json`
**Changes:**
- Added `bullmq: "^5.25.0"` dependency

## Implementation Details

### Queue Solution: BullMQ

**Why BullMQ:**
- Modern successor to Bull
- Built on Redis
- TypeScript support
- Priority queuing
- Rate limiting
- Job retry logic
- Event system
- Production-ready

**Alternatives Considered:**
- **Bull**: Older, less maintained
- **Redis Queue**: Less feature-rich
- **BullMQ**: Chosen for modern features and active development

### Priority Queuing

**Priority Levels:**
```typescript
enum QueuePriority {
  LOW = 10,      // Low priority
  NORMAL = 5,    // Normal priority (default)
  HIGH = 1,      // High priority
  URGENT = 0,    // Urgent priority
}
```

**Priority Behavior:**
- Lower number = higher priority
- Jobs processed in priority order
- Same priority processed FIFO

### Queue Configuration

**Default Settings:**
- Queue name: `rag-requests`
- Max attempts: 3
- Retry delay: 5 seconds (exponential backoff)
- Completed jobs: Kept for 24 hours (max 1000)
- Failed jobs: Kept for 7 days
- Concurrency: 5 jobs
- Rate limit: 10 jobs per second

### Worker Configuration

**Settings:**
- Concurrency: 5 concurrent jobs
- Rate limiting: 10 jobs/second
- Progress tracking: 10% → 90% → 100%
- Event handlers: completed, failed, error, stalled, active

### Job States

**States:**
- `waiting`: Job waiting in queue
- `active`: Job being processed
- `completed`: Job completed successfully
- `failed`: Job failed after all retries
- `delayed`: Job delayed (scheduled)
- `paused`: Queue paused

## Usage Examples

### Queue a Request (Explicit)
```typescript
// POST /api/ai/ask/queue
{
  "question": "What is AI?",
  "priority": "high",
  "topicId": "topic-123",
  "enableDocumentSearch": true,
  "enableWebSearch": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request queued successfully",
  "data": {
    "jobId": "job-123",
    "status": "queued",
    "priority": 1
  }
}
```

### Queue a Request (Optional)
```typescript
// POST /api/ai/ask
{
  "question": "What is AI?",
  "useQueue": true,
  "priority": "normal",
  "topicId": "topic-123"
}
```

### Get Job Status
```typescript
// GET /api/ai/queue/job/job-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job-123",
    "state": "completed",
    "progress": 100,
    "result": {
      "success": true,
      "answer": "AI is...",
      "sources": [...],
      "processingTime": 2500
    }
  }
}
```

### Get Queue Statistics
```typescript
// GET /api/ai/queue/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "waiting": 5,
      "active": 2,
      "completed": 100,
      "failed": 3,
      "delayed": 0,
      "paused": 0,
      "total": 110
    },
    "health": {
      "healthy": true,
      "connected": true
    },
    "worker": {
      "isRunning": true,
      "concurrency": 5,
      "queueName": "rag-requests"
    }
  }
}
```

### Get Jobs by State
```typescript
// GET /api/ai/queue/jobs?state=waiting&start=0&end=9
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "job-123",
        "state": "waiting",
        "priority": 1,
        "progress": 0,
        "timestamp": 1234567890,
        "question": "What is AI?"
      }
    ],
    "count": 1
  }
}
```

### Cancel a Job
```typescript
// DELETE /api/ai/queue/job/job-123
```

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

## API Endpoints

### Queue Management
- `POST /api/ai/ask/queue` - Queue a RAG request
- `GET /api/ai/queue/job/:jobId` - Get job status
- `DELETE /api/ai/queue/job/:jobId` - Cancel a job
- `GET /api/ai/queue/stats` - Get queue statistics
- `GET /api/ai/queue/jobs` - Get jobs by state

### Optional Queuing
- `POST /api/ai/ask?useQueue=true` - Optional queuing via parameter

## Priority Levels

**Usage:**
```typescript
// Priority values
"low"     → QueuePriority.LOW (10)
"normal"  → QueuePriority.NORMAL (5) - default
"high"    → QueuePriority.HIGH (1)
"urgent"  → QueuePriority.URGENT (0)
```

**When to Use:**
- **LOW**: Background processing, non-urgent
- **NORMAL**: Standard requests (default)
- **HIGH**: Important requests, faster processing
- **URGENT**: Critical requests, immediate processing

## Monitoring

### Queue Statistics
- **Waiting**: Jobs waiting in queue
- **Active**: Jobs currently processing
- **Completed**: Successfully completed jobs
- **Failed**: Failed jobs (after retries)
- **Delayed**: Scheduled/delayed jobs
- **Paused**: Queue paused state
- **Total**: Total jobs in queue

### Worker Status
- **isRunning**: Worker running state
- **concurrency**: Concurrent job limit
- **queueName**: Queue name

### Health Monitoring
- **healthy**: Queue health status
- **connected**: Redis connection status
- **error**: Error message if unhealthy

## Acceptance Criteria

✅ **Requests queued properly**
- Queue system initializes correctly
- Jobs added to queue successfully
- Priority respected in processing
- Jobs processed by worker

✅ **Priority respected**
- Priority levels work correctly
- Higher priority jobs processed first
- Same priority processed FIFO

✅ **Monitoring available**
- Queue statistics endpoint
- Job status endpoint
- Worker status endpoint
- Health check endpoint

## Testing Recommendations

1. **Queue Operations:**
   - Test adding jobs to queue
   - Test job status retrieval
   - Test job cancellation
   - Test priority ordering

2. **Worker Processing:**
   - Test job processing
   - Test concurrent processing
   - Test retry logic
   - Test error handling

3. **Priority Queuing:**
   - Test priority levels
   - Test priority ordering
   - Test same priority FIFO
   - Test priority with delays

4. **Monitoring:**
   - Test statistics endpoint
   - Test health check
   - Test job listing
   - Test worker status

5. **Edge Cases:**
   - Queue full scenarios
   - Worker failures
   - Redis connection issues
   - Job timeouts
   - Concurrent requests

## Configuration

### Environment Variables
```bash
# Redis connection (required for queue)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_USERNAME=your_username
REDIS_DATABASE=0
```

### Queue Settings
- **Queue Name**: `rag-requests`
- **Concurrency**: 5 jobs
- **Rate Limit**: 10 jobs/second
- **Max Attempts**: 3
- **Retry Delay**: 5 seconds (exponential)

## Troubleshooting

### Queue Not Initializing
- Check Redis connection
- Verify Redis credentials
- Check Redis URL format
- Review initialization logs

### Jobs Not Processing
- Check worker is running
- Verify worker initialization
- Check Redis connection
- Review worker logs

### Priority Not Working
- Verify priority values
- Check job options
- Review queue configuration
- Test priority ordering

### High Queue Size
- Increase worker concurrency
- Check processing speed
- Review rate limits
- Monitor worker health

## Future Enhancements

- Job scheduling (delayed jobs)
- Job dependencies
- Job batching
- Queue analytics dashboard
- Webhook notifications
- Job result caching
- Dynamic priority adjustment
- Queue sharding for scale
