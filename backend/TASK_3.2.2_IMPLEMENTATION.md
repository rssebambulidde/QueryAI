# Task 3.2.2: Adaptive Context Selection Implementation

## Overview
Implemented an adaptive context selection system that analyzes query complexity and context needs, dynamically adjusts chunk/result counts, balances between document and web results, and integrates with token budgeting to ensure optimal context quality.

## Files Created

### 1. `backend/src/services/adaptive-context.service.ts`
- **AdaptiveContextService**: Main service for adaptive context selection
- **Key Features**:
  - **Query Complexity Analysis**: Analyzes query complexity using ContextSelectorService
  - **Dynamic Adjustment**: Dynamically adjusts chunk/result counts based on query needs
  - **Balance Management**: Balances between document and web results
  - **Token-Aware Selection**: Integrates with token budgeting system
  - **Context Refinement**: Refines selection based on actual retrieved context

- **Selection Algorithm**:
  1. **Query Complexity Analysis**: Analyzes query complexity, intent, and type
  2. **Base Count Calculation**: Calculates base counts from complexity
  3. **Balance Application**: Applies balance preferences (documents vs web)
  4. **Token-Aware Adjustment**: Adjusts based on available token budget
  5. **Bounds Enforcement**: Ensures counts are within min/max limits
  6. **Context Refinement**: Refines selection after context retrieval

- **Methods**:
  - `selectAdaptiveContext(options)`: Main adaptive selection method
  - `refineContextSelection(context, options, initialSelection)`: Refine selection based on actual context
  - `balanceDocumentAndWeb(query, complexity, baseCounts, options)`: Balance documents and web results
  - `getRecommendedContextSizes(query, options)`: Quick recommendation without token budget

## Files Modified

### 1. `backend/src/services/rag.service.ts`
- Added import for `AdaptiveContextService` and `AdaptiveContextOptions`
- Extended `RAGOptions` interface with adaptive context options:
  - `enableAdaptiveContextSelection`: Enable adaptive context selection (default: true)
  - `adaptiveContextOptions`: Custom adaptive context configuration
- Updated `retrieveContext` method:
  - Uses `AdaptiveContextService` for both document chunks and web results
  - Integrates with token budgeting for token-aware selection
  - Applies balance preferences (documents vs web)
  - Refines selection based on actual retrieved context
  - Falls back to legacy `ContextSelectorService` for backward compatibility
  - Logs adaptive selection statistics

## Features

### 1. Query Complexity Analysis

#### Complexity Factors
- **Query Length**: Character and word count
- **Keyword Count**: Number of significant keywords
- **Intent Complexity**: Simple, moderate, or complex
- **Query Type**: Factual, conceptual, procedural, exploratory
- **Complexity Score**: Overall complexity score (0-1)

#### Complexity-Based Adjustment
- **Simple Queries**: Fewer chunks (0.6x multiplier)
- **Moderate Queries**: Standard chunks (1.0x multiplier)
- **Complex Queries**: More chunks (1.5x multiplier)

### 2. Dynamic Chunk/Result Count Adjustment

#### Base Count Calculation
- Calculates base counts from query complexity
- Applies complexity multipliers
- Considers query type adjustments

#### Token-Aware Adjustment
- Estimates tokens per item (documents: ~300, web: ~400)
- Calculates maximum items that fit in token budget
- Reduces counts if budget is limiting
- Increases counts if budget allows

#### Bounds Enforcement
- Ensures counts are within min/max limits
- Respects user-specified constraints
- Prevents over-allocation

### 3. Balance Between Document and Web Results

#### Balance Strategies
- **Prefer Documents**: 30% more documents, 30% fewer web results
- **Prefer Web**: 30% fewer documents, 30% more web results
- **Balanced**: Configurable ratio (default: 50/50)

#### Query Type Adjustments
- **Exploratory/Conceptual**: More web results (1.2x), fewer documents (0.9x)
- **Factual**: More documents (1.1x), fewer web results (0.9x)
- **Procedural**: Balanced approach

### 4. Token Budgeting Integration

#### Token-Aware Selection
- Calculates token budget if not provided
- Estimates tokens per document chunk (~300)
- Estimates tokens per web result (~400)
- Adjusts counts to fit within budget

#### Budget Utilization
- Reduces counts if context exceeds budget
- Increases counts if budget allows
- Optimizes for budget utilization

### 5. Context Refinement

#### Post-Retrieval Refinement
- Counts actual tokens in retrieved context
- Compares with token budget
- Refines selection if needed
- Applies adjustments based on actual usage

#### Refinement Strategies
- **Budget Exceeded**: Reduces counts proportionally
- **Budget Underutilized**: Increases counts if space available
- **Optimal**: No changes needed

## Usage Example

```typescript
// Basic usage (default: adaptive selection enabled)
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
  enableAdaptiveContextSelection: true
});

// Prefer documents
const response = await AIService.askQuestion({
  question: "Latest research",
  userId: "user123",
  adaptiveContextOptions: {
    preferDocuments: true,
    balanceRatio: 0.7, // 70% documents, 30% web
  },
});

// Prefer web results
const response = await AIService.askQuestion({
  question: "Current news",
  userId: "user123",
  adaptiveContextOptions: {
    preferWeb: true,
    balanceRatio: 0.3, // 30% documents, 70% web
  },
});

// Custom constraints
const response = await AIService.askQuestion({
  question: "Complex query",
  userId: "user123",
  adaptiveContextOptions: {
    minDocumentChunks: 5,
    maxDocumentChunks: 15,
    minWebResults: 3,
    maxWebResults: 8,
    enableTokenAwareSelection: true,
  },
});
```

## Adaptive Selection Flow

```
1. Query Analysis
   │
   ├─► Analyze Query Complexity
   │   ├─► Length, word count, keywords
   │   ├─► Intent complexity (simple/moderate/complex)
   │   └─► Query type (factual/conceptual/procedural/exploratory)
   │
   └─► Calculate Base Counts
       ├─► Document chunks from complexity
       └─► Web results from complexity

2. Balance Application
   │
   ├─► Apply Query Type Adjustments
   │   ├─► Exploratory: More web, fewer documents
   │   ├─► Factual: More documents, fewer web
   │   └─► Procedural: Balanced
   │
   ├─► Apply User Preferences
   │   ├─► Prefer Documents: 30% more documents
   │   ├─► Prefer Web: 30% more web results
   │   └─► Balanced: Configurable ratio
   │
   └─► Calculate Balanced Counts

3. Token-Aware Adjustment
   │
   ├─► Calculate Token Budget (if not provided)
   │   └─► Use TokenBudgetService
   │
   ├─► Estimate Tokens Per Item
   │   ├─► Documents: ~300 tokens
   │   └─► Web results: ~400 tokens
   │
   ├─► Check Budget Constraints
   │   ├─► Reduce if exceeds budget
   │   └─► Increase if budget allows
   │
   └─► Apply Token Adjustments

4. Bounds Enforcement
   │
   ├─► Ensure Within Min/Max Limits
   │   ├─► Document chunks: min/max
   │   └─► Web results: min/max
   │
   └─► Return Final Counts

5. Context Refinement (Post-Retrieval)
   │
   ├─► Count Actual Tokens
   │   ├─► Document context tokens
   │   └─► Web results tokens
   │
   ├─► Compare with Budget
   │   ├─► If exceeds: Reduce counts
   │   └─► If underutilized: Increase counts
   │
   └─► Apply Refinements
```

## Acceptance Criteria

✅ **Context adapts to query needs**
- Query complexity analyzed accurately
- Chunk/result counts adjusted based on complexity
- Query type influences document/web balance
- Simple queries get fewer chunks, complex queries get more
- Selection reasoning provided

✅ **Token budget respected**
- Token budget integrated into selection
- Counts adjusted to fit within budget
- Budget utilization optimized
- No context overflow from selection
- Token-aware adjustments applied

✅ **Better context quality**
- Balance between documents and web results
- High-priority items preserved
- Context refined based on actual usage
- Optimal context size for query type
- Improved relevance through adaptive selection

## Selection Strategies

### Simple Queries
- **Complexity**: Simple
- **Document Chunks**: 3-5 (reduced)
- **Web Results**: 2-3 (reduced)
- **Strategy**: Minimal context, focused results

### Moderate Queries
- **Complexity**: Moderate
- **Document Chunks**: 5-10 (standard)
- **Web Results**: 3-5 (standard)
- **Strategy**: Balanced context

### Complex Queries
- **Complexity**: Complex
- **Document Chunks**: 10-20 (increased)
- **Web Results**: 5-10 (increased)
- **Strategy**: Comprehensive context

### Exploratory Queries
- **Query Type**: Exploratory
- **Document Chunks**: Reduced (0.9x)
- **Web Results**: Increased (1.2x)
- **Strategy**: More web results for exploration

### Factual Queries
- **Query Type**: Factual
- **Document Chunks**: Increased (1.1x)
- **Web Results**: Reduced (0.9x)
- **Strategy**: More documents for facts

## Testing Recommendations

1. **Unit Tests**: Test selection algorithm with various queries
2. **Integration Tests**: Test with real queries and contexts
3. **Token Budget Tests**: Verify token-aware adjustments
4. **Balance Tests**: Verify document/web balance
5. **Refinement Tests**: Verify post-retrieval refinement
6. **Edge Cases**: 
   - Very short queries
   - Very long queries
   - Empty queries
   - Complex multi-part queries

## Future Enhancements

1. **Machine Learning**: Learn optimal selection from user feedback
2. **Query Classification**: Better query type detection
3. **Dynamic Balance**: Adjust balance based on query success
4. **Performance Optimization**: Cache complexity analysis
5. **A/B Testing**: Test different selection strategies
6. **User Preferences**: Learn user preferences over time
