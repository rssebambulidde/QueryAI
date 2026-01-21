# Conversation Filter Persistence Feature

## Overview

This feature allows users to persist search filter settings (keyword, time range, country) per conversation. When you start a conversation with specific filters, those filters are saved and automatically applied to all subsequent messages in that conversation. You can also change the filter options for a specific conversation at any time.

## Features

1. **Filter Persistence**: Filter settings are saved per conversation in the database
2. **Automatic Application**: When you select a conversation, its saved filters are automatically loaded and applied
3. **Visual Indicators**: Active filters are displayed in the chat header
4. **Easy Editing**: Filters can be changed at any time for a specific conversation
5. **Filter Clearing**: One-click option to clear all filters for a conversation

## How It Works

### Starting a Conversation with Filters

1. Click the **Filter** button (🔍) in the chat input
2. Set your filters:
   - **Topic/Keyword**: e.g., "bank of uganda"
   - **Time Range**: e.g., "Last 24 hours"
   - **Country**: e.g., "Uganda"
3. Send your first message
4. The filters are automatically saved to the conversation

### Changing Filters for a Conversation

1. Select the conversation you want to modify
2. Click the **Filter** button in the chat input
3. Modify the filter settings
4. Send a message - the new filters are automatically saved

### Viewing Active Filters

When a conversation has active filters, they are displayed in the chat header:
- Keyword/Topic badges
- Time range badges
- Country badges
- A "Clear" button to remove all filters

### Clearing Filters

- Click the **Clear** button next to the active filters in the header, OR
- Open the filter panel and clear all fields, then send a message

## Technical Implementation

### Database Changes

- Added `metadata` JSONB column to `conversations` table
- Migration: `006_add_conversation_metadata.sql`
- Filters are stored in `metadata.filters` as:
  ```json
  {
    "filters": {
      "topic": "bank of uganda",
      "timeRange": "day",
      "country": "UG"
    }
  }
  ```

### Backend Changes

- Updated `ConversationService` to handle metadata updates
- Modified conversation routes to accept `filters` parameter
- Filters are merged with existing metadata when updating

### Frontend Changes

- Added `conversationFilters` state to `ChatInterface`
- Updated `ChatInput` to accept and display conversation filters
- Added filter display in chat header
- Automatic filter loading when conversation is selected
- Automatic filter saving when filters are changed

## Migration Required

**Important**: You must run the database migration before using this feature:

1. Go to Supabase Dashboard → SQL Editor
2. Open `backend/src/database/migrations/006_add_conversation_metadata.sql`
3. Copy and paste the SQL
4. Click **Run**

## Example Use Case

1. Start a new conversation
2. Set filters:
   - Keyword: "bank of uganda"
   - Time Range: "Last 24 hours"
   - Country: "Uganda"
3. Send message: "What are the latest interest rate changes?"
4. All subsequent messages in this conversation will automatically use these filters
5. Switch to another conversation - it will have its own (or no) filters
6. Switch back - your filters are still there!

## Benefits

- **Consistency**: All messages in a conversation use the same filters
- **Convenience**: No need to re-enter filters for each message
- **Organization**: Different conversations can have different filter contexts
- **Flexibility**: Filters can be changed at any time

## Files Modified

### Backend
- `backend/src/database/migrations/006_add_conversation_metadata.sql` (new)
- `backend/src/types/database.ts`
- `backend/src/services/conversation.service.ts`
- `backend/src/routes/conversations.routes.ts`

### Frontend
- `frontend/lib/api.ts`
- `frontend/lib/store/conversation-store.ts`
- `frontend/components/chat/chat-interface.tsx`
- `frontend/components/chat/chat-input.tsx`

### Documentation
- `backend/src/database/migrations/README.md`
