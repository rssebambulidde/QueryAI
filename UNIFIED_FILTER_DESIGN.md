# Unified Filter Panel Design

## Overview
Merge Topics and Search Filters into a single, intelligent filtering system.

## Design Principles

1. **Unified Interface**: One panel for all filtering needs
2. **Clear Distinction**: Visual separation between persistent (Topics) and temporary (Quick Filters)
3. **Smart Suggestions**: Help users discover and create topics
4. **Progressive Disclosure**: Show advanced options when needed
5. **Contextual Help**: Guide users on when to use what

## Component Structure

```
UnifiedFilterPanel
├── TopicScopeSection (Persistent)
│   ├── TopicSelector (dropdown + create)
│   ├── SelectedTopicBadge (with remove)
│   └── TopicDescription (if selected)
│
├── QuickFiltersSection (Temporary)
│   ├── KeywordInput (with "Save as Topic" suggestion)
│   ├── TimeRangeSelector
│   ├── CountrySelector
│   └── CustomDateRange (if custom selected)
│
└── Actions
    ├── ApplyButton
    ├── ClearButton
    └── InfoTooltip
```

## Visual Design

### Color Coding
- **Topics**: Orange (#f97316) - indicates persistence
- **Quick Filters**: Blue (#3b82f6) - indicates temporary
- **Active States**: Highlighted backgrounds
- **Suggestions**: Amber/yellow for smart suggestions

### Layout
- **Top Section**: Topic Scope (larger, more prominent)
- **Bottom Section**: Quick Filters (compact, collapsible)
- **Actions**: Bottom bar with primary actions

## Smart Features

### 1. Keyword-to-Topic Suggestion
When user types a keyword without a topic selected:
- Show suggestion: "💡 Save 'keyword' as a topic?"
- On click: Open quick topic creation modal
- After creation: Auto-select the new topic

### 2. Topic Auto-Complete
When typing in keyword field:
- If no topic selected: Suggest matching topics
- Show: "Did you mean: [Topic Name]?"
- Allow quick selection

### 3. Contextual Help
- Show tooltips explaining difference
- Example: "Topics organize conversations and filter documents. Quick filters refine web search only."

### 4. Smart Defaults
- If topic selected: Pre-fill keyword with topic name
- If no topic: Show "Create topic for better organization"

## State Management

```typescript
interface UnifiedFilterState {
  // Persistent (Topic)
  selectedTopicId: string | null;
  selectedTopic: Topic | null;
  
  // Temporary (Quick Filters)
  keyword: string;
  timeRange: TimeRange | null;
  startDate: string | null;
  endDate: string | null;
  country: string | null;
  
  // UI State
  showCreateTopic: boolean;
  showAdvancedFilters: boolean;
  suggestions: FilterSuggestion[];
}
```

## User Flows

### Flow 1: Quick Search (No Topic)
1. User opens filter panel
2. Enters keyword: "renewable energy"
3. Sets time: "Last week"
4. Sets country: "Kenya"
5. Clicks Apply
6. **Suggestion appears**: "Save 'renewable energy' as topic?"
7. User can ignore or create topic

### Flow 2: Topic-Based Work
1. User opens filter panel
2. Selects topic: "Bank of Uganda"
3. Adds quick filter: "Last 24 hours"
4. Clicks Apply
5. Both filters work together

### Flow 3: Create Topic from Keyword
1. User types keyword: "Uganda Politics"
2. Clicks "Save as Topic"
3. Quick creation modal opens
4. User adds description (optional)
5. Topic created and auto-selected
6. Keyword field cleared (now using topic)

## Implementation Plan

### Phase 1: Component Structure
- Create UnifiedFilterPanel component
- Implement TopicScopeSection
- Implement QuickFiltersSection
- Add basic styling

### Phase 2: Smart Features
- Add keyword-to-topic suggestion
- Add topic auto-complete
- Add contextual help tooltips

### Phase 3: Integration
- Replace existing Topic selector
- Replace existing Search Filters
- Update chat interface
- Update state management

### Phase 4: Polish
- Add animations
- Improve accessibility
- Add keyboard shortcuts
- Add mobile responsiveness

## Benefits

1. **Reduced Confusion**: One place for all filtering
2. **Better Discovery**: Users learn about topics through suggestions
3. **Improved Workflow**: Seamless transition from quick filters to topics
4. **Clearer Mental Model**: Visual distinction helps users understand persistence
5. **Enhanced UX**: Smart suggestions guide users to best practices
