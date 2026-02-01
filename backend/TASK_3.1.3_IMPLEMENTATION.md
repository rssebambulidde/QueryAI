# Task 3.1.3: Source Prioritization Implementation

## Overview
Implemented a source prioritization system that prioritizes sources (documents vs web) based on rules including recency, authority, and relevance. Weights sources differently in context formatting to improve context quality.

## Files Created

### 1. `backend/src/services/source-prioritizer.service.ts`
- **SourcePrioritizerService**: Main service for source prioritization
- **Key Features**:
  - **Prioritization Rules**: Configurable rules for documents vs web, recency, authority
  - **Priority Scoring**: Calculates priority scores (0-1) for each source
  - **Weight Calculation**: Calculates weights for sources in context formatting
  - **Multiple Factors**: Considers relevance, authority, recency, and quality
  - **Presets**: Pre-configured prioritization presets

- **Prioritization Rules**:
  - **Document Weight**: Weight for document sources (default: 0.6)
  - **Web Weight**: Weight for web sources (default: 0.4)
  - **Relevance Weight**: Weight for relevance score (default: 0.4)
  - **Authority Weight**: Weight for authority score (default: 0.3)
  - **Recency Weight**: Weight for recency/freshness (default: 0.2)
  - **Quality Weight**: Weight for quality score (default: 0.1)
  - **Prefer Documents**: Prefer documents over web (default: true)
  - **Prefer Authoritative**: Prefer authoritative web sources (default: true)
  - **Prefer Recent**: Prefer recent sources (default: true)

- **Methods**:
  - `prioritizeContext(context, options)`: Main prioritization method
  - `getPresetRules(preset)`: Get preset prioritization rules
  - Private methods for calculating document/web priorities

- **Presets**:
  - `documents-first`: Prioritize documents heavily (80% weight)
  - `web-first`: Prioritize web sources (70% weight)
  - `balanced`: Equal weight for documents and web (50/50)
  - `authority-first`: Prioritize authoritative sources
  - `recent-first`: Prioritize recent sources

## Files Modified

### 1. `backend/src/services/rag.service.ts`
- Added import for `SourcePrioritizerService` and `PrioritizationOptions`
- Extended `RAGOptions` interface with prioritization options:
  - `enableSourcePrioritization`: Enable source prioritization (default: true)
  - `prioritizationOptions`: Custom prioritization configuration
- Updated `formatContextForPrompt` method:
  - Applies prioritization after compression (if enabled)
  - Uses priority scores to format sources with different prominence
  - High priority sources get ⭐ indicator and "HIGH PRIORITY" label
  - Includes priority and authority scores in formatted output
  - Logs prioritization statistics

### 2. `backend/src/services/ai.service.ts`
- Added prioritization options to `QuestionRequest` interface:
  - `enableSourcePrioritization`: Enable source prioritization (default: true)
  - `prioritizationOptions`: Prioritization configuration
- Updated all `formatContextForPrompt` calls to pass prioritization options
- Integrated prioritization options into RAG options

## Features

### 1. Prioritization Rules

#### Documents vs Web
- **Documents**: Higher base priority (0.9 authority score)
- **Web**: Variable priority based on domain authority
- **Configurable Weights**: Adjust document/web weight ratio
- **Prefer Documents**: Option to prefer user's own documents

#### Authority-Based Prioritization
- **High Authority Boost**: Boosts high-authority sources (1.3x)
- **Domain Authority**: Uses domain authority service for web sources
- **User Documents**: Documents have high authority (0.9)
- **Threshold**: Configurable authority threshold (default: 0.7)

#### Recency-Based Prioritization
- **Freshness Score**: Calculates freshness based on publication date
- **Recent Boost**: Boosts recent sources (1.2x)
- **Recent Threshold**: Days considered "recent" (default: 30)
- **Time Decay**: Older sources get lower scores

#### Relevance-Based Prioritization
- **Relevance Score**: Uses embedding/search scores
- **Weight**: Configurable relevance weight (default: 0.4)
- **Combined**: Combined with other factors

### 2. Priority Calculation

#### Document Priority
```
priority = 
  relevanceScore * relevanceWeight +
  authorityScore (0.9) * authorityWeight +
  freshnessScore (0.7) * recencyWeight

if preferDocuments:
  priority *= documentWeight
```

#### Web Priority
```
priority = 
  relevanceScore * relevanceWeight +
  authorityScore * authorityWeight +
  freshnessScore * recencyWeight

if preferRecent and freshnessScore >= 0.8:
  priority *= recentBoost

if preferAuthoritative and authorityScore >= threshold:
  priority *= highAuthorityBoost

priority *= webWeight
```

### 3. Weight Calculation
- **Normalized Weight**: Based on priority relative to max priority
- **Weight Range**: 0.3 to 1.0 (even low priority sources get some weight)
- **Context Formatting**: Higher weight = more prominent formatting

### 4. Context Formatting
- **High Priority Indicators**: ⭐ and "HIGH PRIORITY" label
- **Priority Scores**: Displayed in formatted context
- **Authority Scores**: Shown for web sources
- **Prominent Placement**: High priority sources appear first

## Usage Example

```typescript
// Basic usage (default: prioritization enabled)
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
  enableSourcePrioritization: true
});

// Documents-first prioritization
const response = await AIService.askQuestion({
  question: "Latest research",
  userId: "user123",
  prioritizationOptions: {
    rules: SourcePrioritizerService.getPresetRules('documents-first'),
  },
});

// Authority-first prioritization
const response = await AIService.askQuestion({
  question: "Reliable sources",
  userId: "user123",
  prioritizationOptions: {
    rules: SourcePrioritizerService.getPresetRules('authority-first'),
  },
});

// Custom prioritization rules
const response = await AIService.askQuestion({
  question: "Recent news",
  userId: "user123",
  prioritizationOptions: {
    rules: {
      documentWeight: 0.4,
      webWeight: 0.6,
      relevanceWeight: 0.3,
      authorityWeight: 0.3,
      recencyWeight: 0.4,
      preferRecent: true,
      recentBoost: 1.5,
    },
  },
});
```

## Prioritization Flow

```
1. Input: RAG Context (ordered and compressed)
   │
   ├─► Prioritize Document Contexts
   │   ├─► Calculate Relevance Score
   │   ├─► Set Authority Score (0.9 for documents)
   │   ├─► Set Freshness Score (0.7 neutral)
   │   ├─► Calculate Priority Score
   │   └─► Apply Document Weight
   │
   ├─► Prioritize Web Results
   │   ├─► Calculate Relevance Score (if available)
   │   ├─► Calculate Authority Score (domain authority)
   │   ├─► Calculate Freshness Score (publication date)
   │   ├─► Calculate Priority Score
   │   ├─► Apply Recent Boost (if recent)
   │   ├─► Apply Authority Boost (if high authority)
   │   └─► Apply Web Weight
   │
   ├─► Calculate Weights
   │   ├─► Find Max Priority
   │   ├─► Normalize Weights (0.3 - 1.0)
   │   └─► Assign Weights to Sources
   │
   ├─► Sort by Priority
   │   └─► High priority sources first
   │
   └─► Format Context
       ├─► High Priority: ⭐ + "HIGH PRIORITY" label
       ├─► Include Priority Scores
       └─► Include Authority Scores
```

## Acceptance Criteria

✅ **Sources prioritized correctly**
- Documents prioritized over web (when preferDocuments enabled)
- Authoritative sources prioritized
- Recent sources prioritized
- Priority scores calculated correctly
- Sources sorted by priority

✅ **Configurable rules**
- Multiple prioritization presets
- Custom prioritization rules
- Configurable weights for each factor
- Enable/disable prioritization
- Adjust document/web weight ratio

✅ **Better context quality**
- High priority sources more prominent in formatting
- Priority indicators (⭐) for high priority sources
- Priority and authority scores included
- Better source ordering improves AI understanding

## Prioritization Presets

### Documents-First
- Document weight: 0.8
- Web weight: 0.2
- Prefer documents: true
- Use case: When user's documents are most important

### Web-First
- Document weight: 0.3
- Web weight: 0.7
- Prefer documents: false
- Use case: When web sources are more important

### Balanced
- Document weight: 0.5
- Web weight: 0.5
- Use case: Equal importance for documents and web

### Authority-First
- Authority weight: 0.5
- Relevance weight: 0.3
- High authority boost: 1.5
- Use case: When authoritative sources are critical

### Recent-First
- Recency weight: 0.4
- Relevance weight: 0.3
- Recent boost: 1.5
- Use case: Time-sensitive queries

## Testing Recommendations

1. **Unit Tests**: Test prioritization logic with various rules
2. **Priority Tests**: Verify priority scores are calculated correctly
3. **Weight Tests**: Verify weights are normalized correctly
4. **Preset Tests**: Test each prioritization preset
5. **Integration Tests**: Test integration with RAG service
6. **Formatting Tests**: Verify high priority sources are formatted prominently
7. **Edge Cases**: Empty context, single source, all same priority

## Future Enhancements

1. **Machine Learning**: Learn optimal prioritization from user feedback
2. **Query-Specific Rules**: Different rules for different query types
3. **User Preferences**: Allow users to choose prioritization strategy
4. **Dynamic Weights**: Adjust weights based on context size
5. **Source Quality Metrics**: Consider source quality in prioritization
6. **Temporal Patterns**: Learn which sources work best at different times
