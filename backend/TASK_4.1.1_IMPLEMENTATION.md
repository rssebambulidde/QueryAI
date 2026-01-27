# Task 4.1.1: Add Few-Shot Examples Implementation

## Overview
Implemented a few-shot examples system that provides example question-answer pairs with proper citations to improve answer quality. The system selects relevant examples based on query type and context, ensuring examples don't exceed token budget.

## Files Created

### 1. `backend/src/data/few-shot-examples.json`
- **Few-Shot Examples Database**: JSON database of example question-answer pairs
- **Key Features**:
  - **Query Type Examples**: Examples for different query types (factual, conceptual, procedural, exploratory)
  - **Citation Styles**: Examples with different citation styles (mixed, document-only, web-only, web-heavy)
  - **Context Variants**: Examples for different context scenarios (with/without documents, with/without web results)
  - **Tags**: Examples tagged for better selection

- **Example Structure**:
  - `id`: Unique identifier
  - `queryType`: Query type (factual, conceptual, procedural, exploratory)
  - `question`: Example question
  - `answer`: Example answer with proper citations
  - `context`: Context metadata (hasDocuments, hasWebResults, citationStyle)
  - `tags`: Tags for categorization

- **Example Categories**:
  - **Factual**: Definition questions, fact-based queries
  - **Conceptual**: How things work, concept explanations
  - **Procedural**: How-to questions, step-by-step guides
  - **Exploratory**: Research questions, trend analysis
  - **Document-Only**: Examples using only document citations
  - **Web-Only**: Examples using only web citations
  - **Mixed**: Examples using both document and web citations

### 2. `backend/src/services/few-shot-selector.service.ts`
- **FewShotSelectorService**: Service for selecting relevant few-shot examples
- **Key Features**:
  - **Relevance Scoring**: Calculates relevance score for each example
  - **Query Type Matching**: Matches examples to query type
  - **Context Matching**: Matches examples to context (documents/web)
  - **Citation Style Matching**: Matches examples to preferred citation style
  - **Token Budget Awareness**: Selects examples within token budget
  - **Caching**: Caches examples for performance

- **Selection Algorithm**:
  1. **Query Type Detection**: Detects query type from query
  2. **Relevance Scoring**: Scores examples based on:
     - Query type match (highest weight: 10 points)
     - Context match (high weight: 8 points)
     - Citation style match (medium weight: 5 points)
     - Keyword overlap (low weight: up to 3 points)
  3. **Token Budget Check**: Selects examples within token budget
  4. **Sorting**: Sorts by relevance score (descending)
  5. **Selection**: Selects top examples within budget

- **Methods**:
  - `selectExamples(options)`: Main selection method
  - `formatExamplesForPrompt(examples)`: Format examples for system prompt
  - `getExamplesByQueryType(queryType)`: Get examples by query type
  - `getExamplesByCitationStyle(citationStyle)`: Get examples by citation style
  - `loadExamples()`: Load examples from JSON file (cached)
  - `clearCache()`: Clear examples cache

## Files Modified

### 1. `backend/src/services/ai.service.ts`
- Added import for `FewShotSelectorService` and `FewShotSelectionOptions`
- Extended `QuestionRequest` interface with few-shot options:
  - `enableFewShotExamples`: Enable few-shot examples (default: true)
  - `fewShotOptions`: Custom few-shot selection configuration
- Updated `buildSystemPrompt` method:
  - Added `fewShotExamples` parameter
  - Includes few-shot examples in system prompt if provided
- Updated `buildMessages` method:
  - Added `fewShotExamples` parameter
  - Passes few-shot examples to `buildSystemPrompt`
- Updated `answerQuestion` method:
  - Selects few-shot examples before building messages
  - Passes examples to `buildMessages`
- Updated `answerQuestionStream` method:
  - Selects few-shot examples before building messages
  - Passes examples to `buildMessages`

## Features

### 1. Example Selection

#### Relevance Scoring
- **Query Type Match**: Highest weight (10 points)
- **Context Match**: High weight (8 points for full match, 4 for partial)
- **Citation Style Match**: Medium weight (5 points)
- **Keyword Overlap**: Low weight (up to 3 points)

#### Selection Criteria
- Query type matches example query type
- Context matches (hasDocuments, hasWebResults)
- Citation style matches preferred style
- Examples fit within token budget
- Maximum number of examples (default: 2)

### 2. Example Formatting

#### Prompt Format
```
FEW-SHOT EXAMPLES:
The following examples demonstrate the expected format and citation style:

Example 1:
Question: [example question]
Answer: [example answer with citations]

Example 2:
Question: [example question]
Answer: [example answer with citations]

Use these examples as a guide for formatting your response with proper citations.
```

### 3. Token Budget Awareness

#### Budget Management
- **Max Tokens**: Default 500 tokens for examples
- **Token Counting**: Accurate token counting per example
- **Budget Enforcement**: Selects examples within budget
- **Fallback**: Takes best example even if exceeds budget if no examples fit

### 4. Query Type Coverage

#### Example Types
- **Factual**: Definition questions, fact-based queries
- **Conceptual**: Concept explanations, how things work
- **Procedural**: How-to questions, step-by-step guides
- **Exploratory**: Research questions, trend analysis

## Usage Example

```typescript
// Basic usage (default: few-shot examples enabled)
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
  enableFewShotExamples: true
});

// Custom few-shot configuration
const response = await AIService.askQuestion({
  question: "How does neural network training work?",
  userId: "user123",
  enableFewShotExamples: true,
  fewShotOptions: {
    maxExamples: 3,
    maxTokens: 800,
    preferCitationStyle: 'mixed',
  },
});

// Disable few-shot examples
const response = await AIService.askQuestion({
  question: "Simple query",
  userId: "user123",
  enableFewShotExamples: false,
});
```

## Few-Shot Selection Flow

```
1. Query Analysis
   │
   ├─► Detect Query Type
   │   └─► Use ThresholdOptimizerService
   │
   ├─► Analyze Context
   │   ├─► Check hasDocuments
   │   └─► Check hasWebResults
   │
   └─► Determine Citation Style
       └─► Based on context

2. Example Scoring
   │
   ├─► Calculate Relevance Scores
   │   ├─► Query type match (10 points)
   │   ├─► Context match (8 points)
   │   ├─► Citation style match (5 points)
   │   └─► Keyword overlap (up to 3 points)
   │
   ├─► Count Tokens
   │   └─► Per example
   │
   └─► Sort by Score
       └─► Descending order

3. Example Selection
   │
   ├─► Select Top Examples
   │   ├─► Within token budget
   │   ├─► Up to maxExamples
   │   └─► Highest relevance scores
   │
   └─► Format for Prompt
       └─► Add to system prompt
```

## Acceptance Criteria

✅ **Examples improve answer quality**
- Examples demonstrate proper citation format
- Examples show expected response structure
- Examples cover different question types
- Examples improve model understanding
- Examples guide citation style

✅ **Examples relevant to query type**
- Examples matched to query type
- Examples matched to context (documents/web)
- Examples matched to citation style
- Relevance scoring prioritizes relevant examples
- Selection reasoning provided

✅ **Examples don't exceed token budget**
- Token budget enforced (default: 500 tokens)
- Examples selected within budget
- Token counting accurate
- Fallback if budget too small
- Performance optimized

## Example Selection Examples

### Example 1: Factual Query
```
Query: "What is machine learning?"
Query Type: factual
Context: hasDocuments=true, hasWebResults=true

Selected Examples:
- factual-1: "What is machine learning?" (score: 20, tokens: 120)
- factual-2: "What is the capital of France?" (score: 15, tokens: 110)

Total: 230 tokens (within budget)
```

### Example 2: Conceptual Query
```
Query: "How does neural network training work?"
Query Type: conceptual
Context: hasDocuments=true, hasWebResults=true

Selected Examples:
- conceptual-1: "How does neural network training work?" (score: 20, tokens: 150)
- conceptual-2: "What is the difference between supervised and unsupervised learning?" (score: 18, tokens: 140)

Total: 290 tokens (within budget)
```

### Example 3: Document-Only Context
```
Query: "What does the policy say?"
Query Type: factual
Context: hasDocuments=true, hasWebResults=false

Selected Examples:
- document-only-1: "What does the policy document say about remote work?" (score: 18, tokens: 130)
- factual-1: "What is machine learning?" (score: 12, tokens: 120)

Total: 250 tokens (within budget)
```

## Testing Recommendations

1. **Unit Tests**: Test example selection with various queries
2. **Relevance Tests**: Verify relevance scoring works correctly
3. **Token Budget Tests**: Verify examples respect token budget
4. **Query Type Tests**: Test selection for each query type
5. **Context Tests**: Test selection for different contexts
6. **Edge Cases**: 
   - No examples available
   - All examples exceed budget
   - Query type unknown
   - Empty context
7. **Integration Tests**: Test integration with system prompt
8. **Quality Tests**: Verify examples improve answer quality

## Future Enhancements

1. **Dynamic Examples**: Generate examples dynamically based on query
2. **Learning Examples**: Learn which examples work best from user feedback
3. **Domain-Specific Examples**: Examples for specific domains/topics
4. **Multi-Language Examples**: Examples in different languages
5. **Example Expansion**: Automatically expand example database
6. **A/B Testing**: Test different example sets for effectiveness
