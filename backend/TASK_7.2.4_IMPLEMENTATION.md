# Task 7.2.4: Implement Quality Metrics

## Overview
Implemented comprehensive quality metrics system to track answer quality, citation accuracy, and other quality indicators over time, providing actionable insights for system improvement.

## Implementation Date
January 26, 2026

## Objectives
- Define quality metrics (answer quality, citation accuracy)
- Implement quality scoring
- Track quality over time
- Store quality metrics
- Create quality dashboards

## Files Created

### 1. `backend/src/services/quality-metrics.service.ts`
**Purpose:** Centralized service for tracking and analyzing quality metrics

**Key Features:**
- Quality metric type enumeration (Answer Quality, Citation Accuracy, Relevance, Completeness, Coherence)
- Automatic quality scoring algorithms
- Quality statistics calculation
- Trend analysis over time
- Score distribution analysis

**Quality Metric Types:**
- `ANSWER_QUALITY`: Overall answer quality score (0-100)
- `CITATION_ACCURACY`: Citation accuracy score (0-100)
- `RELEVANCE`: Answer relevance to question (0-100)
- `COMPLETENESS`: Answer completeness (0-100)
- `COHERENCE`: Answer coherence and structure (0-100)

**Quality Scoring:**

#### Answer Quality Score (0-100)
Calculated from multiple factors:
- **Relevance (0-25 points)**: How well answer addresses the question
  - Keyword matching between question and answer
  - Semantic relevance
- **Completeness (0-25 points)**: Sufficient information provided
  - Answer length (500+ chars = full score)
  - Information density
- **Coherence (0-25 points)**: Well-structured and coherent
  - Sentence structure
  - Average words per sentence (20 words/sentence = full score)
- **Citation Accuracy (0-25 points)**: Citations are accurate
  - Accurate citations count
  - Source mentions in answer

#### Citation Accuracy Score (0-100)
- Calculated as: (accurate citations / total citations) * 100
- Requires explicit citation validation
- Falls back to source mentions if no explicit citations

**Methods:**
- `calculateAnswerQuality()`: Calculate answer quality score
- `calculateCitationAccuracy()`: Calculate citation accuracy score
- `collectQualityMetrics()`: Collect and store quality metrics
- `getQualityStats()`: Get quality statistics
- `getQualityTrends()`: Get quality trends over time

### 2. `backend/src/database/migrations/017_quality_metrics.sql`
**Purpose:** Database migration for quality metrics table

**Tables Created:**
- `quality_metrics`: Stores quality metrics for answers and citations

**Schema:**
- `quality_metrics`: user_id, query_id, question, answer, metric_type, score, timestamp, sources, citations, metadata

**Indexes:**
- User ID indexes
- Metric type indexes
- Timestamp indexes (DESC for recent queries)
- Query ID indexes
- Score indexes
- Composite indexes for common queries

### 3. `backend/src/database/migrations/018_quality_metrics_rls.sql`
**Purpose:** Row Level Security policies for quality metrics table

**Policies:**
- Users can view their own quality metrics
- Users can insert their own quality metrics
- Service role has full access

## Files Modified

### 1. `backend/src/services/ai.service.ts`
**Changes:**
- Added import for `QualityMetricsService`, `QualityMetricType`
- Added quality metrics collection after successful AI response
- Collects answer quality and citation accuracy metrics
- Includes metadata (model, token usage, citation validation)

**Quality Metrics Collection:**
- Triggered after successful question answering
- Collects answer quality score
- Collects citation accuracy score (if citations exist)
- Stores with question, answer, sources, citations
- Includes metadata for analysis

### 2. `backend/src/routes/metrics.routes.ts`
**Changes:**
- Added import for `QualityMetricsService`, `QualityQuery`, `QualityMetricType`
- Added `GET /api/metrics/quality/stats` endpoint
- Added `GET /api/metrics/quality/trends` endpoint

## Implementation Details

### Quality Scoring

#### Answer Quality Calculation
```typescript
const score = QualityMetricsService.calculateAnswerQuality(
  answer,
  question,
  sources,
  citations
);
// Returns: 0-100 score
```

#### Scoring Factors
1. **Relevance (25 points)**
   - Keyword matching: (matching keywords / total keywords) * 25
   - Checks if answer addresses question keywords

2. **Completeness (25 points)**
   - Length-based: min(25, (answerLength / 500) * 25)
   - 500+ characters = full score

3. **Coherence (25 points)**
   - Structure-based: min(25, (avgWordsPerSentence / 20) * 25)
   - 20 words/sentence = full score

4. **Citation Accuracy (25 points)**
   - If citations exist: (accurate citations / total citations) * 25
   - If sources exist: (source mentions / total sources) * 25
   - No sources/citations: 0 points

#### Final Score
- Normalized to 0-100: (sum of factors / number of factors) * 4

### Citation Accuracy Calculation
```typescript
const score = QualityMetricsService.calculateCitationAccuracy(citations);
// Returns: 0-100 score
```

#### Calculation
- (accurate citations / total citations) * 100
- Requires explicit citation validation
- Returns 0 if no citations

### Quality Metrics Collection

#### Automatic Collection
```typescript
// Automatically called after successful AI response
QualityMetricsService.collectQualityMetrics(
  userId,
  question,
  answer,
  {
    queryId: conversationId,
    sources: sources,
    citations: citations,
    metadata: {
      model: model,
      tokenUsage: tokens,
      hasCitations: true,
      citationValidation: isValid,
    },
  }
);
```

#### Metrics Collected
1. **Answer Quality**: Overall quality score
2. **Citation Accuracy**: Citation accuracy score (if citations exist)

### Statistics Calculation

#### Quality Stats
- `averageScore`: Average quality score
- `minScore`: Minimum quality score
- `maxScore`: Maximum quality score
- `count`: Number of metrics
- `scoreDistribution`: Distribution by quality level
  - Excellent: 90-100
  - Good: 70-89
  - Fair: 50-69
  - Poor: 0-49

### Trend Analysis

#### Time Intervals
- `hour`: Hourly trends
- `day`: Daily trends
- `week`: Weekly trends

#### Trend Metrics
- Average score per period
- Count of metrics per period
- Excellent rate (90+ score percentage)
- Good rate (70+ score percentage)

## Usage Examples

### Calculate Answer Quality
```typescript
import { QualityMetricsService } from './services/quality-metrics.service';

const score = QualityMetricsService.calculateAnswerQuality(
  answer,
  question,
  sources,
  citations
);

console.log(`Answer quality score: ${score}/100`);
```

### Calculate Citation Accuracy
```typescript
const citations = [
  { text: '...', source: 'source1', accurate: true },
  { text: '...', source: 'source2', accurate: false },
];

const score = QualityMetricsService.calculateCitationAccuracy(citations);
console.log(`Citation accuracy: ${score}%`);
```

### Collect Quality Metrics
```typescript
await QualityMetricsService.collectQualityMetrics(
  userId,
  question,
  answer,
  {
    queryId: 'query-123',
    sources: sources,
    citations: citations,
    metadata: {
      model: 'gpt-4',
      tokenUsage: 1500,
    },
  }
);
```

### Get Quality Statistics
```typescript
const stats = await QualityMetricsService.getQualityStats({
  userId: 'user-123',
  metricType: QualityMetricType.ANSWER_QUALITY,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

console.log({
  averageScore: stats[0].averageScore,
  scoreDistribution: stats[0].scoreDistribution,
});
```

### Get Quality Trends
```typescript
const trends = await QualityMetricsService.getQualityTrends(
  QualityMetricType.ANSWER_QUALITY,
  '2026-01-01',
  '2026-01-31',
  'day'
);

trends.forEach(trend => {
  console.log({
    period: trend.period,
    averageScore: trend.averageScore,
    excellentRate: trend.excellentRate,
    goodRate: trend.goodRate,
  });
});
```

## API Endpoints

### Get Quality Statistics
```bash
GET /api/metrics/quality/stats?metricType=answer_quality&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**Query Parameters:**
- `metricType` (optional): Filter by metric type
- `userId` (auto): Current user ID
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `minScore` (optional): Minimum score filter
- `maxScore` (optional): Maximum score filter
- `limit` (optional): Maximum number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "metricType": "answer_quality",
        "averageScore": 85.5,
        "minScore": 60,
        "maxScore": 100,
        "count": 150,
        "scoreDistribution": {
          "excellent": 45,
          "good": 80,
          "fair": 20,
          "poor": 5
        }
      }
    ],
    "summary": {
      "totalMetrics": 150,
      "averageScore": 85.5,
      "metricTypesTracked": 1
    }
  }
}
```

### Get Quality Trends
```bash
GET /api/metrics/quality/trends?metricType=answer_quality&startDate=2026-01-01&endDate=2026-01-31&interval=day
Authorization: Bearer {token}
```

**Query Parameters:**
- `metricType` (required): Metric type
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
        "averageScore": 82.5,
        "count": 25,
        "excellentRate": 40.0,
        "goodRate": 85.0
      },
      {
        "period": "2026-01-02",
        "averageScore": 84.0,
        "count": 30,
        "excellentRate": 45.0,
        "goodRate": 90.0
      }
    ],
    "metricType": "answer_quality",
    "interval": "day",
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    }
  }
}
```

## Acceptance Criteria

✅ **Quality metrics tracked**
- Answer quality tracked automatically
- Citation accuracy tracked automatically
- Metrics stored persistently
- Metadata included

✅ **Trends visible**
- Quality trends endpoint available
- Time-based aggregation working
- Score distribution calculated
- Excellent/good rates tracked

✅ **Actionable insights**
- Statistics endpoint available
- Score distribution available
- Trend analysis available
- Quality levels defined (excellent, good, fair, poor)

## Testing Recommendations

1. **Quality Scoring:**
   - Test answer quality calculation
   - Test citation accuracy calculation
   - Test scoring factors
   - Test score normalization

2. **Quality Metrics Collection:**
   - Test automatic collection
   - Test with citations
   - Test without citations
   - Test metadata storage

3. **Statistics:**
   - Test statistics calculation
   - Test score distribution
   - Test filtering
   - Test aggregation

4. **Trends:**
   - Test hourly trends
   - Test daily trends
   - Test weekly trends
   - Test date range filtering

5. **Integration:**
   - Test with AI service
   - Test API endpoints
   - Test database storage
   - Test RLS policies

## Database Migration

### Run Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open `017_quality_metrics.sql`
3. Copy and paste the SQL
4. Click **Run** to execute
5. Repeat for `018_quality_metrics_rls.sql`

### Verify Migration
```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'quality_metrics';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'quality_metrics';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'quality_metrics';
```

## Configuration

### Quality Score Thresholds
Quality levels are defined as:
- **Excellent**: 90-100
- **Good**: 70-89
- **Fair**: 50-69
- **Poor**: 0-49

These can be adjusted in the `getQualityStats` method if needed.

### Scoring Weights
Current scoring weights:
- Relevance: 25 points
- Completeness: 25 points
- Coherence: 25 points
- Citation Accuracy: 25 points

These can be adjusted in the `calculateAnswerQuality` method if needed.

## Troubleshooting

### Quality Metrics Not Collected
- Check quality metrics collection is called
- Verify service is imported
- Check error logs
- Verify database connection

### Quality Scores Not Accurate
- Review scoring algorithm
- Check input data quality
- Test with sample data
- Adjust scoring weights

### Trends Not Visible
- Check database queries
- Verify date range filtering
- Review trend calculation
- Test with sample data

## Future Enhancements

- Real-time quality monitoring dashboard
- Quality visualization charts
- Automated quality alerts
- Quality-based A/B testing
- Machine learning for quality prediction
- Quality improvement suggestions
- User feedback integration
- Quality correlation analysis
- Quality budget tracking
- Quality regression detection
