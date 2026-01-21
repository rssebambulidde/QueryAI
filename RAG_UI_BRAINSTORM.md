# RAG Source Selector UI - Brainstorming & Implementation Plan

**Date:** 2025-01-27  
**Feature:** User-configurable RAG source selection (Documents, Web, or Both)

---

## 🎯 Core Requirements

Users need to be able to:
1. ✅ Toggle document search ON/OFF
2. ✅ Toggle web search (Tavily) ON/OFF
3. ✅ Use both simultaneously
4. ✅ See visual feedback about their selection
5. ✅ Have settings persist (optional - localStorage)

---

## 🎨 UI Design Options

### Option 1: Toggle Switches (Recommended)
**Pros:**
- Clear ON/OFF state
- Familiar UI pattern
- Easy to understand
- Can show both enabled simultaneously

**Cons:**
- Takes more vertical space
- Might be confusing if both are off (no search)

**Design:**
```
┌─────────────────────────────────────┐
│  📚 Document Search    [Toggle ON]  │
│  🌐 Web Search         [Toggle ON]  │
└─────────────────────────────────────┘
```

### Option 2: Segmented Control (iOS-style)
**Pros:**
- Compact
- Clear mutual exclusivity or combination
- Modern look

**Cons:**
- Harder to show "Both" option clearly
- Less flexible

**Design:**
```
┌──────────┬──────────┬──────────┐
│ Documents│   Web    │   Both   │
│    ✓     │          │          │
└──────────┴──────────┴──────────┘
```

### Option 3: Radio Buttons with "Both" Option
**Pros:**
- Very clear options
- Explicit "Both" choice
- Standard form pattern

**Cons:**
- Takes more space
- Less modern

**Design:**
```
○ Documents Only
○ Web Only
● Both (Recommended)
```

### Option 4: Icon Buttons with Badges
**Pros:**
- Visual and compact
- Can show active state with colors
- Modern and intuitive

**Cons:**
- Less explicit for new users
- Needs tooltips

**Design:**
```
[📚 Documents] [🌐 Web] [⚡ Both]
   (Active)     (Active)  (Preset)
```

---

## 📍 Placement Options

### Option A: Chat Header (Recommended)
**Location:** Next to "Chat with AI" title in the header

**Pros:**
- Always visible
- Doesn't clutter input area
- Professional look

**Cons:**
- Might be overlooked
- Limited space

**Layout:**
```
┌─────────────────────────────────────────────┐
│ [Sparkles] Chat with AI    [📚] [🌐] [Clear]│
└─────────────────────────────────────────────┘
```

### Option B: Above Input Area
**Location:** Between messages and input box

**Pros:**
- Contextual - right where user types
- More space for controls
- Can include more options

**Cons:**
- Takes up message space
- Might be distracting

**Layout:**
```
[Messages Area]
┌─────────────────────────────────────┐
│ Source: [📚 Documents] [🌐 Web]    │
└─────────────────────────────────────┘
[Input Area]
```

### Option C: Collapsible Settings Panel
**Location:** Expandable section above input

**Pros:**
- Clean default view
- Can include advanced options
- Doesn't clutter UI

**Cons:**
- Hidden by default
- Extra click to access

**Layout:**
```
[Input Area]
[⚙️ Advanced Settings ▼]
  └─ Source Selection
  └─ Document Filter
  └─ Chunk Settings
```

### Option D: Integrated with Search Filters
**Location:** Part of existing filter panel

**Pros:**
- Reuses existing UI pattern
- Logical grouping
- Already has expand/collapse

**Cons:**
- Hidden behind filter button
- Might be missed

---

## 🚀 Recommended Implementation

### Primary Choice: **Toggle Switches in Chat Header**

**Rationale:**
- Always visible
- Clear state indication
- Professional appearance
- Easy to understand

### Secondary: **Collapsible Advanced Panel**

For additional options:
- Document selection (specific documents)
- Chunk count slider
- Similarity score threshold
- Topic filtering

---

## ✨ Additional Features & Improvements

### 1. **Visual Indicators**

**Document Search:**
- Show count: "📚 Documents (5 processed)"
- Show status: "📚 Documents (Ready)" or "📚 Documents (No documents)"
- Badge with processed document count
- Warning if no documents processed

**Web Search:**
- Show status: "🌐 Web (Tavily)" or "🌐 Web (Unavailable)"
- Connection indicator
- Rate limit indicator (if applicable)

### 2. **Smart Presets**

**Quick Mode Buttons:**
- **"Smart"** - Uses both, auto-selects best sources
- **"Documents Only"** - Only user's documents
- **"Web Only"** - Only web search
- **"Custom"** - User-defined combination

### 3. **Document Selector**

**When Documents Enabled:**
- Dropdown to select specific documents
- Multi-select for multiple documents
- "All Documents" option (default)
- Search/filter documents in dropdown
- Show document status (processed/not processed)

### 4. **Advanced RAG Settings**

**Collapsible Advanced Panel:**
- **Max Document Chunks:** Slider (1-10, default: 5)
- **Min Similarity Score:** Slider (0.0-1.0, default: 0.7)
- **Max Web Results:** Input (default: 5)
- **Topic Filter:** Text input (optional)
- **Document IDs:** Multi-select (if document selector implemented)

### 5. **Status Indicators**

**Real-time Feedback:**
- Loading state: "🔍 Searching documents..."
- Success: "✅ Found 3 relevant chunks"
- Warning: "⚠️ No documents match your query"
- Error: "❌ Document search unavailable"

### 6. **Source Attribution in UI**

**Enhanced Source Display:**
- Color-code sources (Documents = Blue, Web = Green)
- Show similarity scores for documents
- Clickable document names (link to document view)
- Expandable source snippets

### 7. **Persistent Settings**

**User Preferences:**
- Save to localStorage
- Remember last used combination
- Per-session or persistent
- Reset to defaults option

### 8. **Contextual Help**

**Tooltips & Help:**
- Tooltip on hover: "Search your uploaded documents"
- Info icon with explanation
- Help text: "Enable both for comprehensive answers"
- Examples: "Try: 'What did my report say about X?'"

### 9. **Keyboard Shortcuts**

**Quick Actions:**
- `Ctrl+D` - Toggle document search
- `Ctrl+W` - Toggle web search
- `Ctrl+B` - Enable both
- `Ctrl+N` - Disable both

### 10. **Analytics & Feedback**

**Usage Tracking:**
- Track which mode users prefer
- Show usage stats (optional)
- A/B testing for UI variants
- User feedback collection

---

## 🎯 Implementation Plan

### Phase 1: Core Toggle Switches (MVP)
1. ✅ Add toggle switches to chat header
2. ✅ Update QuestionRequest interface with RAG options
3. ✅ Pass RAG options to API calls
4. ✅ Visual feedback (active/inactive states)
5. ✅ Basic tooltips

### Phase 2: Enhanced UI
1. ✅ Document count indicator
2. ✅ Status indicators (ready/unavailable)
3. ✅ Smart presets (Smart/Documents/Web/Custom)
4. ✅ Collapsible advanced panel
5. ✅ Persistent settings (localStorage)

### Phase 3: Advanced Features
1. ✅ Document selector dropdown
2. ✅ Chunk count & similarity sliders
3. ✅ Topic filtering UI
4. ✅ Enhanced source attribution
5. ✅ Keyboard shortcuts

---

## 📐 Component Structure

### New Components

1. **`RAGSourceSelector.tsx`**
   - Main component with toggles
   - Handles state management
   - Emits changes to parent

2. **`RAGAdvancedSettings.tsx`**
   - Collapsible panel
   - Advanced options
   - Document selector
   - Chunk settings

3. **`RAGPresets.tsx`**
   - Quick mode buttons
   - Preset configurations
   - Visual indicators

### Modified Components

1. **`chat-interface.tsx`**
   - Add RAGSourceSelector to header
   - Pass RAG options to handleSend
   - Update QuestionRequest with RAG options

2. **`chat-input.tsx`**
   - Integrate RAG options (if placed here)
   - Show RAG status in input area

3. **`lib/api.ts`**
   - Update QuestionRequest interface
   - Add RAG option types

---

## 🎨 Visual Design Mockup

### Header Layout
```
┌─────────────────────────────────────────────────────────────┐
│ [Sparkles] Chat with AI                                       │
│                                                               │
│ Source Selection:                                            │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ 📚 Documents     │  │ 🌐 Web Search    │                  │
│ │ [Toggle: ON]     │  │ [Toggle: ON]     │                  │
│ │ 5 processed      │  │ Tavily Ready     │                  │
│ └─────────────────┘  └─────────────────┘                  │
│                                                               │
│ [⚙️ Advanced] [Clear Chat]                                  │
└─────────────────────────────────────────────────────────────┘
```

### Advanced Panel (Collapsed)
```
┌─────────────────────────────────────────────────────────────┐
│ [⚙️ Advanced Settings ▼]                                    │
└─────────────────────────────────────────────────────────────┘
```

### Advanced Panel (Expanded)
```
┌─────────────────────────────────────────────────────────────┐
│ [⚙️ Advanced Settings ▲]                                    │
│                                                               │
│ Document Selection:                                           │
│ [Select Documents ▼] All Documents                           │
│                                                               │
│ RAG Settings:                                                 │
│ Max Document Chunks: [━━━━●━━━━] 5                           │
│ Min Similarity:     [━━━━━━●━━] 0.7                          │
│ Max Web Results:    [5]                                       │
│                                                               │
│ Topic Filter: [________________]                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation Details

### State Management

```typescript
interface RAGSettings {
  enableDocumentSearch: boolean;
  enableWebSearch: boolean;
  documentIds?: string[];
  maxDocumentChunks?: number;
  minScore?: number;
  maxWebResults?: number;
  topicId?: string;
}

// In ChatInterface component
const [ragSettings, setRagSettings] = useState<RAGSettings>({
  enableDocumentSearch: true,
  enableWebSearch: true,
  maxDocumentChunks: 5,
  minScore: 0.7,
  maxWebResults: 5,
});
```

### API Integration

```typescript
// Update QuestionRequest
const request: QuestionRequest = {
  question: content,
  conversationHistory,
  enableDocumentSearch: ragSettings.enableDocumentSearch,
  enableWebSearch: ragSettings.enableWebSearch,
  documentIds: ragSettings.documentIds,
  maxDocumentChunks: ragSettings.maxDocumentChunks,
  minScore: ragSettings.minScore,
  maxSearchResults: ragSettings.maxWebResults,
  topicId: ragSettings.topicId,
};
```

### Persistence

```typescript
// Save to localStorage
useEffect(() => {
  localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
}, [ragSettings]);

// Load from localStorage
useEffect(() => {
  const saved = localStorage.getItem('ragSettings');
  if (saved) {
    setRagSettings(JSON.parse(saved));
  }
}, []);
```

---

## ✅ Success Criteria

1. ✅ User can toggle document search ON/OFF
2. ✅ User can toggle web search ON/OFF
3. ✅ User can enable both simultaneously
4. ✅ Visual feedback shows current state
5. ✅ Settings are passed to API correctly
6. ✅ UI is intuitive and doesn't clutter
7. ✅ Works on mobile devices (responsive)
8. ✅ Settings persist across sessions (optional)

---

## 🚦 Priority Ranking

### Must Have (MVP)
1. ✅ Toggle switches for Documents/Web
2. ✅ Visual active/inactive states
3. ✅ Pass settings to API
4. ✅ Basic tooltips

### Should Have
1. ✅ Document count indicator
2. ✅ Status indicators
3. ✅ Smart presets
4. ✅ Persistent settings

### Nice to Have
1. ✅ Document selector
2. ✅ Advanced settings panel
3. ✅ Chunk count sliders
4. ✅ Keyboard shortcuts
5. ✅ Enhanced source attribution

---

## 📝 Next Steps

1. **Review & Approval:** Get user feedback on design options
2. **Implementation:** Start with MVP (Phase 1)
3. **Testing:** Test with real documents and web search
4. **Iteration:** Add enhancements based on usage
5. **Documentation:** Update user guide with RAG features

---

**Ready to implement?** Let's start with the MVP: Toggle switches in the chat header! 🚀
