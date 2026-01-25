# Time Filtering Improvement Plan

## Current Problem
- User filters for "Last 24 hours" but gets results mentioning "November 5, 2025"
- Tavily's `publishedDate` may be missing, incorrect, or unreliable
- Content may mention dates that contradict the publishedDate

## Best Approach: Multi-Layer Date Validation

### Strategy 1: Content-Based Date Extraction (RECOMMENDED)
**Why:** More reliable than relying solely on Tavily's publishedDate

**Implementation:**
1. Extract dates from content using regex patterns:
   - "November 5, 2025" → Date object
   - "2025-11-05" → Date object
   - "11/5/2025" → Date object
   - Years like "2025", "2026" → Check if future

2. For "Last 24 hours" filtering:
   - **Primary check**: Use publishedDate if available and valid
   - **Secondary check**: Extract dates from content
   - **Exclude if**:
     - No publishedDate AND content mentions dates outside range
     - Content mentions future dates (2025+) when filtering for recent content
     - Any extracted date from content is outside the time range

3. **Strict mode for "Last 24 hours"**:
   - Exclude results without publishedDate (too risky)
   - Exclude results with future dates in content
   - Exclude results where content dates are clearly outside 24 hours

### Strategy 2: Enhanced Query Modification
**Why:** Help Tavily return more recent results

**Implementation:**
- Add explicit time constraints to query: "bank of uganda jobs last 24 hours OR today OR recent"
- Use date-specific keywords based on time range
- This helps Tavily's ranking algorithm prioritize recent content

### Strategy 3: Hybrid Approach (BEST)
**Why:** Combines reliability of content parsing with query optimization

**Implementation:**
1. **Query Enhancement**: Add time keywords to help Tavily
2. **Post-Processing**: 
   - Parse dates from content (multiple formats)
   - Validate against time range
   - Exclude if content dates contradict time filter
3. **Strict Filtering for Short Time Ranges**:
   - "Last 24 hours" → Very strict (exclude if uncertain)
   - "Last week" → Moderate strictness
   - "Last month/year" → More lenient

## Recommended Implementation Priority

1. **Immediate**: Improve content date extraction and validation
2. **Short-term**: Add strict mode for "last 24 hours"
3. **Long-term**: Consider using Tavily's date filtering parameters more effectively

## Code Structure

```typescript
// Helper function to extract dates from content
function extractDatesFromContent(content: string): Date[] {
  // Multiple regex patterns for different date formats
  // Return array of parsed dates
}

// Enhanced filtering logic
function filterByTimeRange(results, timeRange, cutoffDate) {
  return results.filter(result => {
    // 1. Check publishedDate
    // 2. Extract dates from content
    // 3. Validate all dates against cutoffDate
    // 4. For "last 24 hours", be very strict
  });
}
```

## Benefits
- More accurate filtering
- Handles cases where publishedDate is wrong
- Catches content mentioning future dates
- Better user experience
