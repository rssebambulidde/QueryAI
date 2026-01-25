-- Collections & Organization Feature
-- Phase 3.4: Collections for organizing conversations

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#f97316', -- Default orange color
    icon TEXT, -- Optional icon identifier
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Junction table for collections and conversations (many-to-many)
CREATE TABLE IF NOT EXISTS collection_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, conversation_id) -- Prevent duplicate entries
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_conversations_collection_id ON collection_conversations(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_conversations_conversation_id ON collection_conversations(conversation_id);

-- Add updated_at trigger for collections
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
