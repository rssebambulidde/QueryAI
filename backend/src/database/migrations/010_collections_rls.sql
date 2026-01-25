-- Row Level Security Policies for Collections
-- Phase 3.4: Collections RLS

-- Enable RLS on collections table
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Enable RLS on collection_conversations table
ALTER TABLE collection_conversations ENABLE ROW LEVEL SECURITY;

-- Collections Policies
-- Users can view their own collections
CREATE POLICY "Users can view own collections"
    ON collections FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own collections
CREATE POLICY "Users can create own collections"
    ON collections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own collections
CREATE POLICY "Users can update own collections"
    ON collections FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections"
    ON collections FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access to collections
CREATE POLICY "Service role full access to collections"
    ON collections FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Collection Conversations Policies
-- Users can view collection_conversations for their own collections
CREATE POLICY "Users can view own collection conversations"
    ON collection_conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM collections
            WHERE collections.id = collection_conversations.collection_id
            AND collections.user_id = auth.uid()
        )
    );

-- Users can add conversations to their own collections
CREATE POLICY "Users can add to own collections"
    ON collection_conversations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collections
            WHERE collections.id = collection_conversations.collection_id
            AND collections.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = collection_conversations.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can remove conversations from their own collections
CREATE POLICY "Users can remove from own collections"
    ON collection_conversations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM collections
            WHERE collections.id = collection_conversations.collection_id
            AND collections.user_id = auth.uid()
        )
    );

-- Service role full access to collection_conversations
CREATE POLICY "Service role full access to collection conversations"
    ON collection_conversations FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
