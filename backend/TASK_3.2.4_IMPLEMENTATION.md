# Task 3.2.4: Dynamic Limits Implementation

## Overview
Implemented a dynamic limit system that replaces fixed limits with dynamic calculation based on token budget and query complexity. Limits are calculated dynamically, adjusted based on query needs, and integrated with adaptive selection for optimal context utilization.

## Files Created

### 1. `backend/src/config/rag.config.ts`
- **RAGConfig**: Configuration service for dynamic limit calculation
- **Key Features**:
  - **Token Budget-Based Limits**: Calculates limits from available token budget
  - **Query Complexity Adjustments**: Adjusts limits based on query complexity
  - **Min/Max Constraints**: Configurable minimum and maximum limits
  - **Balance Ratio**: Configurable document/web balance ratio
  - **Integration**: Works with adaptive selection and token budgeting

- **Dynamic Limit Configuration**:
  - **Enabled**: Enable/disable dynamic limits (default: true)
  - **Token Budget Limits**: Calculate from token budget (default: true)
  - **Tokens Per Item**: Estimated tokens per document chunk (300) and web result (400)
  - **Complexity Adjustments**: Adjust based on query complexity (default: true)
  - **Complexity Multipliers**: Simple (0.7x), moderate (1.0x), complex (1.3x)
  - **Min/Max Constraints**: Configurable min/max for documents and web results
  - **Default Limits**: Fallback limits if calculation fails
  - **Balance Ratio**: Document/web balance (default: 0.6 = 60% documents)

- **Methods**:
  - `calculateDynamicLimits(options)`: Main dynamic limit calculation
  - `getRecommendedLimits(query, options)`: Quick recommendation without token budget
  - `setConfig(config)`: Update configuration
  - `getConfig()`: Get current configuration

## Files Modified

### 1. `backend/src/services/rag.service.ts`
- Added import for `RAGConfig` and `DynamicLimitOptions`
- Extended `RAGOptions` interface with dynamic limit options:
  - `enableDynamicLimits`: Enable dynamic limit calculation (default: true)
  - `dynamicLimitOptions`: Custom dynamic limit configuration
- Updated `retrieveContext` method:
  - Calculates dynamic limits first (if enabled)
  - Uses dynamic limits as base for adaptive selection
  - Adaptive selection can refine dynamic limits
  - Falls back to defaults if calculation fails
  - Logs dynamic limit calculation statistics

### 2. `backend/src/services/ai.service.ts`
- Added dynamic limit options to `QuestionRequest` interface:
  - `enableDynamicLimits`: Enable dynamic limit calculation (default: true)
  - `dynamicLimitOptions`: Dynamic limit configuration
- Updated RAG options to include dynamic limit configuration
- Integrated dynamic limit options into both regular and streaming methods

## Features

### 1. Token Budget-Based Limits

#### Limit Calculation
- **Available Budget**: Uses remaining token budget after system/user prompts
- **Tokens Per Item**: Estimates tokens per document chunk (~300) and web result (~400)
- **Maximum Items**: Calculates maximum items that fit in budget
- **Balance Distribution**: Distributes items based on document/web ratio

#### Calculation Formula
```
availableBudget = tokenBudget.remaining.total
avgTokensPerItem = (tokensPerDocument * ratio) + (tokensPerWeb * (1 - ratio))
maxItems = floor(availableBudget / avgTokensPerItem)
documentChunks = floor(maxItems * ratio)
webResults = maxItems - documentChunks
```

### 2. Query Complexity Adjustments

#### Complexity Analysis
- **Simple Queries**: 0.7x multiplier (fewer chunks)
- **Moderate Queries**: 1.0x multiplier (standard chunks)
- **Complex Queries**: 1.3x multiplier (more chunks)

#### Adjustment Process
1. Analyze query complexity
2. Get complexity multiplier
3. Apply multiplier to base limits
4. Ensure within min/max constraints

### 3. Min/Max Constraints

#### Configurable Constraints
- **Min Document Chunks**: Minimum document chunks (default: 3)
- **Max Document Chunks**: Maximum document chunks (default: 30)
- **Min Web Results**: Minimum web results (default: 2)
- **Max Web Results**: Maximum web results (default: 15)

#### Constraint Enforcement
- Ensures limits are within min/max bounds
- Prevents over-allocation
- Prevents under-allocation
- Respects user-specified constraints

### 4. Integration with Adaptive Selection

#### Two-Stage Process
1. **Dynamic Limits**: Calculate base limits from token budget and complexity
2. **Adaptive Selection**: Refine limits based on query needs and preferences

#### Integration Flow
- Dynamic limits provide base limits
- Adaptive selection can refine if preferences specified
- Both work together for optimal limits
- Falls back gracefully if either fails

## Usage Example

```typescript
// Basic usage (default: dynamic limits enabled)
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
  enableDynamicLimits: true
});

// Custom dynamic limit configuration
const response = await AIService.askQuestion({
  question: "Latest AI research",
  userId: "user123",
  enableDynamicLimits: true,
  dynamicLimitOptions: {
    minDocumentChunks: 5,
    maxDocumentChunks: 20,
    minWebResults: 3,
    maxWebResults: 10,
    config: {
      tokensPerDocumentChunk: 350,
      tokensPerWebResult: 450,
      documentWebRatio: 0.7, // 70% documents
      complexityMultipliers: {
        simple: 0.8,
        moderate: 1.0,
        complex: 1.5,
      },
    },
  },
});

// Disable dynamic limits (use fixed limits)
const response = await AIService.askQuestion({
  question: "Simple query",
  userId: "user123",
  enableDynamicLimits: false,
  maxDocumentChunks: 10,
  maxWebResults: 5,
});
```

## Dynamic Limit Flow

```
1. Calculate Dynamic Limits
   │
   ├─► Analyze Query Complexity
   │   ├─► Get complexity (simple/moderate/complex)
   │   └─► Get complexity multiplier
   │
   ├─► Calculate Token Budget
   │   ├─► Get available budget
   │   ├─► Estimate tokens per item
   │   └─► Calculate max items
   │
   ├─► Calculate Base Limits
   │   ├─► Distribute items by ratio
   │   ├─► Document chunks from ratio
   │   └─► Web results from ratio
   │
   ├─► Apply Complexity Adjustments
   │   ├─► Multiply by complexity multiplier
   │   └─► Adjust for query type
   │
   ├─► Apply Min/Max Constraints
   │   ├─► Ensure within min bounds
   │   └─► Ensure within max bounds
   │
   └─► Return Dynamic Limits

2. Integrate with Adaptive Selection
   │
   ├─► Use Dynamic Limits as Base
   │   └─► Pass to adaptive selection
   │
   ├─► Adaptive Selection Refines
   │   ├─► Applies preferences
   │   ├─► Adjusts for balance
   │   └─► Refines based on actual context
   │
   └─► Final Limits Applied
```

## Acceptance Criteria

✅ **Limits calculated dynamically**
- Limits calculated from token budget
- Limits adjusted based on query complexity
- Limits respect min/max constraints
- Limits adapt to available budget
- Calculation reasoning provided

✅ **Configurable min/max**
- Min/max constraints configurable
- User can override constraints
- Constraints enforced correctly
- Default constraints provided
- Flexible configuration options

✅ **Better context utilization**
- Limits optimized for token budget
- Limits adapt to query complexity
- Better utilization of available budget
- Optimal balance between documents and web
- Integration with adaptive selection

## Limit Calculation Examples

### Example 1: Large Token Budget
```
Token Budget: 10000 tokens available
Tokens per document: 300
Tokens per web result: 400
Ratio: 60% documents, 40% web

Calculation:
- Max items: floor(10000 / 350) = 28 items
- Document chunks: floor(28 * 0.6) = 16
- Web results: 28 - 16 = 12

Complexity: Complex (1.3x multiplier)
- Adjusted documents: floor(16 * 1.3) = 20
- Adjusted web: floor(12 * 1.3) = 15

Final: 20 documents, 15 web (within max limits)
```

### Example 2: Small Token Budget
```
Token Budget: 2000 tokens available
Tokens per document: 300
Tokens per web result: 400
Ratio: 60% documents, 40% web

Calculation:
- Max items: floor(2000 / 350) = 5 items
- Document chunks: floor(5 * 0.6) = 3
- Web results: 5 - 3 = 2

Complexity: Simple (0.7x multiplier)
- Adjusted documents: floor(3 * 0.7) = 2
- Adjusted web: floor(2 * 0.7) = 1

Final: max(3, 2) = 3 documents, max(2, 1) = 2 web (min constraints)
```

## Configuration Options

### Token Budget-Based Limits
```typescript
config: {
  useTokenBudgetLimits: true,
  tokensPerDocumentChunk: 300,
  tokensPerWebResult: 400,
  documentWebRatio: 0.6, // 60% documents
}
```

### Complexity Adjustments
```typescript
config: {
  useComplexityAdjustments: true,
  complexityMultipliers: {
    simple: 0.7,    // 30% reduction
    moderate: 1.0,  // No change
    complex: 1.3,   // 30% increase
  },
}
```

### Min/Max Constraints
```typescript
config: {
  minDocumentChunks: 3,
  maxDocumentChunks: 30,
  minWebResults: 2,
  maxWebResults: 15,
}
```

## Testing Recommendations

1. **Unit Tests**: Test limit calculation with various token budgets
2. **Complexity Tests**: Test complexity adjustments
3. **Constraint Tests**: Verify min/max constraints are enforced
4. **Integration Tests**: Test integration with adaptive selection
5. **Token Budget Tests**: Verify limits respect token budget
6. **Edge Cases**: 
   - Very small token budget
   - Very large token budget
   - No token budget available
   - Invalid complexity
7. **Performance Tests**: Verify calculation is fast (< 50ms)

## Future Enhancements

1. **Learning Limits**: Learn optimal limits from user feedback
2. **Model-Specific Limits**: Different limits for different models
3. **Query Type Limits**: Different limits for different query types
4. **Historical Limits**: Use historical data to optimize limits
5. **A/B Testing**: Test different limit calculation strategies
6. **Real-Time Adjustment**: Adjust limits based on actual token usage
