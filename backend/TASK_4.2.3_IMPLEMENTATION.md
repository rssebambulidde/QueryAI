# Task 4.2.3: Implement Sliding Window for Long Conversations Implementation

## Overview
Implemented sliding window algorithm for handling long conversations. The system now keeps the most recent N messages in a window and summarizes older messages, ensuring token budget is respected while prioritizing recent context.

## Files Created

### 1. `backend/src/services/sliding-window.service.ts`
- **SlidingWindowService**: Service for implementing sliding window algorithm
- **Key Features**:
  - **Window Management**: Keeps most recent N messages (configurable window size)
  - **Summarization Integration**: Summarizes older messages using existing summarization service
  - **Token Budget Management**: Respects token budget for window + summary
  - **Smart Trimming**: Automatically trims window if it exceeds token budget
  - **Optimal Window Calculation**: Calculates optimal window size based on token budget

- **Methods**:
  - `applySlidingWindow(messages, options)`: Main method to apply sliding window
  - `formatWindowForHistory(result)`: Format sliding window result for conversation history
  - `calculateOptimalWindowSize(messages, maxTotalTokens, reservedSummaryTokens, model)`: Calculate optimal window size
  - `countMessageTokens(messages, encodingType)`: Count tokens in messages
  - `trimToTokenBudget(messages, maxTokens, encodingType)`: Trim messages to fit token budget
  - `truncateToTokenBudget(text, maxTokens, encodingType)`: Truncate text to fit token budget

- **Sliding Window Process**:
  1. Check if messages fit in window (if not, proceed)
  2. Extract window (most recent N messages)
  3. Extract older messages (messages before window)
  4. Count tokens in window
  5. Trim window if it exceeds token budget
  6. Calculate available tokens for summary
  7. Summarize older messages if enabled
  8. Combine window + summary
  9. Return formatted result

## Files Modified

### 1. `backend/src/services/message.service.ts`
- Added import for `SlidingWindowService` and `SlidingWindowOptions`
- Added `getSlidingWindowHistory` method:
  - Fetches all messages for a conversation
  - Applies sliding window using `SlidingWindowService`
  - Returns formatted history with window + summary

### 2. `backend/src/services/ai.service.ts`
- Extended `QuestionRequest` interface with sliding window options:
  - `enableSlidingWindow`: Enable sliding window for long conversations (default: true)
  - `slidingWindowOptions`: Sliding window configuration
- Updated `answerQuestion` method:
  - Uses sliding window if enabled (default)
  - Falls back to summarization if sliding window disabled
  - Falls back to raw history if both disabled
- Updated `answerQuestionStream` method:
  - Same sliding window logic as `answerQuestion`

## Features

### 1. Sliding Window Algorithm

#### Window Management
- **Recent Messages**: Keeps most recent N messages (default: 10)
- **Older Messages**: Summarizes messages before the window
- **Configurable Size**: Window size is configurable via options
- **Token-Aware**: Window size adjusted based on token budget

#### Window Size Configuration
- `windowSize`: Number of recent messages to keep (default: 10)
- `maxTotalTokens`: Maximum total tokens for window + summary (default: 2000)
- `maxSummaryTokens`: Maximum tokens for summary (default: 1000)
- `enableSummarization`: Enable summarization of older messages (default: true)
- `summarizationOptions`: Options for summarization service
- `model`: Model for token counting (default: 'gpt-3.5-turbo')

### 2. Token Budget Management

#### Budget Allocation
- **Window Tokens**: Tokens used by recent messages
- **Summary Tokens**: Tokens used by summary of older messages
- **Total Budget**: Maximum total tokens (window + summary)
- **Dynamic Allocation**: Allocates tokens between window and summary

#### Smart Trimming
- **Window Trimming**: Trims window from oldest messages if it exceeds budget
- **Summary Truncation**: Truncates summary if it exceeds allocated tokens
- **Priority**: Prioritizes recent messages over summary

### 3. Integration with Summarization

#### Summarization Service
- **Reuses Existing Service**: Uses `ConversationSummarizerService` for summarization
- **Configurable Options**: Passes summarization options through
- **Token Budget**: Adjusts summarization token budget based on window size
- **Preserve None**: Doesn't preserve messages in summarization (window already has them)

### 4. History Formatting

#### Format for History
- **Summary First**: Adds summary as assistant message with marker
- **Window Messages**: Adds window messages after summary
- **Maintains Order**: Maintains chronological order
- **Compatible Format**: Compatible with existing conversation history format

## Usage Example

```typescript
// Automatic sliding window when conversationId is provided
const response = await AIService.askQuestion({
  question: "What did we discuss about machine learning?",
  userId: "user123",
  conversationId: "conv123",
  enableSlidingWindow: true,
  slidingWindowOptions: {
    windowSize: 10,
    maxTotalTokens: 2000,
    maxSummaryTokens: 1000,
    enableSummarization: true,
  },
});

// Manual sliding window application
const windowResult = await SlidingWindowService.applySlidingWindow(
  conversationHistory,
  {
    windowSize: 10,
    maxTotalTokens: 2000,
    maxSummaryTokens: 1000,
  }
);

// Format for history
const formattedHistory = SlidingWindowService.formatWindowForHistory(windowResult);

// Calculate optimal window size
const optimalSize = SlidingWindowService.calculateOptimalWindowSize(
  messages,
  2000, // maxTotalTokens
  1000, // reservedSummaryTokens
  'gpt-3.5-turbo'
);
```

## Sliding Window Flow

```
1. Check if Window Needed
   │
   ├─► Messages length <= windowSize?
   │   └─► No: Return messages as-is
   │
   └─► Yes: Continue to window extraction

2. Extract Window
   │
   ├─► Get most recent N messages (window)
   │
   └─► Get older messages (before window)

3. Count Window Tokens
   │
   ├─► Count tokens in window
   │
   ├─► Window tokens > maxTotalTokens?
   │   └─► Yes: Trim window from oldest
   │
   └─► Calculate available tokens for summary

4. Summarize Older Messages
   │
   ├─► Older messages exist?
   │   ├─► No: Skip summarization
   │   │
   │   └─► Yes: Summarize with token budget
   │       ├─► Generate summary
   │       ├─► Count summary tokens
   │       └─► Truncate if exceeds budget
   │
   └─► Combine window + summary

5. Format for History
   │
   ├─► Add summary as assistant message (if present)
   │
   └─► Add window messages
```

## Example: Long Conversation

### Before Sliding Window
```
Conversation (50 messages):
- Message 1: "What is machine learning?"
- Message 2: "Machine learning is..."
- ... (46 more messages)
- Message 49: "Thanks for the help"
- Message 50: "You're welcome"
```

### After Sliding Window (windowSize: 10, maxTotalTokens: 2000)
```
Window (10 messages):
- Message 41: "How does neural network training work?"
- Message 42: "Neural network training..."
- ... (6 more messages)
- Message 49: "Thanks for the help"
- Message 50: "You're welcome"

Summary (40 messages summarized):
- "[Previous conversation summary]: The conversation covered machine learning basics, including definitions, applications, and neural network training. Key topics included supervised learning, unsupervised learning, and deep learning architectures."

Total: 1 summary message + 10 window messages = 11 messages
```

## Acceptance Criteria

✅ **Long conversations handled**
- Sliding window keeps recent messages
- Older messages summarized
- Token budget respected
- Works with conversations of any length
- Graceful handling of edge cases

✅ **Recent context prioritized**
- Most recent N messages always kept
- Window trimmed if needed, but recent messages prioritized
- Summary provides context for older messages
- Chronological order maintained

✅ **Token budget respected**
- Total tokens (window + summary) <= maxTotalTokens
- Window trimmed if exceeds budget
- Summary truncated if exceeds allocated tokens
- Optimal window size calculation available
- Token counting accurate

## Integration with Other Features

### With Conversation Summarization
- Sliding window uses summarization service for older messages
- Can be used together or separately
- Sliding window takes precedence when both enabled

### With History Filtering
- History filtering applied after sliding window
- Filters window messages by relevance
- Summary not filtered (already condensed)

### With Token Budgeting
- Sliding window respects token budget
- Integrates with token budgeting system
- Calculates optimal window size based on budget

## Testing Recommendations

1. **Unit Tests**: Test sliding window with various message counts and token budgets
2. **Integration Tests**: Test integration with conversation and AI services
3. **Token Budget Tests**: Test token budget management and trimming
4. **Edge Cases**:
   - Empty conversation
   - Very short conversation
   - Very long conversation
   - Window size > message count
   - Window exceeds token budget
   - Summary exceeds allocated tokens
   - Summarization failures
5. **Performance Tests**: Test processing time for long conversations
6. **Quality Tests**: Verify recent context is preserved and summary is accurate

## Future Enhancements

1. **Adaptive Window Size**: Adjust window size based on message length
2. **Multi-Level Summarization**: Summarize in chunks for very long conversations
3. **Window Caching**: Cache window results for faster retrieval
4. **Smart Window Selection**: Select messages based on relevance, not just recency
5. **Window Compression**: Compress window messages if needed
6. **Window Analytics**: Track window effectiveness and token usage
7. **User Preferences**: Allow users to configure window size preferences
