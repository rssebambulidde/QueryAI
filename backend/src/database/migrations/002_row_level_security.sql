-- Row Level Security (RLS) Policies
-- Run this after creating the schema (001_initial_schema.sql)

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to user_profiles"
    ON user_profiles FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Topics Policies
-- Users can view their own topics
CREATE POLICY "Users can view own topics"
    ON topics FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own topics
CREATE POLICY "Users can create own topics"
    ON topics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own topics
CREATE POLICY "Users can update own topics"
    ON topics FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own topics
CREATE POLICY "Users can delete own topics"
    ON topics FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to topics"
    ON topics FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Conversations Policies
-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own conversations
CREATE POLICY "Users can create own conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to conversations"
    ON conversations FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Messages Policies
-- Users can view messages in their own conversations
CREATE POLICY "Users can view messages in own conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can create messages in their own conversations
CREATE POLICY "Users can create messages in own conversations"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can update messages in their own conversations
CREATE POLICY "Users can update messages in own conversations"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can delete messages in their own conversations
CREATE POLICY "Users can delete messages in own conversations"
    ON messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to messages"
    ON messages FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Subscriptions Policies
-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role full access (users can't directly create/update subscriptions)
CREATE POLICY "Service role full access to subscriptions"
    ON subscriptions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Usage Logs Policies
-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
    ON usage_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can create usage logs
CREATE POLICY "Service role can create usage logs"
    ON usage_logs FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Service role full access
CREATE POLICY "Service role full access to usage_logs"
    ON usage_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
