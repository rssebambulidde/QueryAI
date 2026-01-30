-- Enterprise Tier & Team Collaboration (Week 9–10)
-- Adds enterprise tier, team tables, and enterprise inquiry storage.
-- Note: 012 is used by retrieval_metrics_rls; this migration is 026.

-- 1. Add 'enterprise' to tier constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tier_check') THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_tier_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_tier_check') THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_pending_tier_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_tier_check') THEN
    ALTER TABLE payments DROP CONSTRAINT payments_tier_check;
  END IF;
END $$;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_pending_tier_check
  CHECK (pending_tier IS NULL OR pending_tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));

ALTER TABLE payments
  ADD CONSTRAINT payments_tier_check
  CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));

-- 2. Update overage_records tier check if present
ALTER TABLE overage_records DROP CONSTRAINT IF EXISTS overage_records_tier_check;
ALTER TABLE overage_records
  ADD CONSTRAINT overage_records_tier_check
  CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));

-- 3. Teams (owned by user; optional link to subscription)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_subscription_id ON teams(subscription_id);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Team members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Team invites
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  inviter_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);

-- 6. Enterprise inquiries (contact-sales form)
CREATE TABLE IF NOT EXISTS enterprise_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_created_at ON enterprise_inquiries(created_at);

-- RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );
CREATE POLICY "Owners can manage own teams"
  ON teams FOR ALL
  USING (owner_id = auth.uid());
CREATE POLICY "Service role full access teams"
  ON teams FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view"
  ON team_members FOR SELECT
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins and owners can manage members"
  ON team_members FOR ALL
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  );
CREATE POLICY "Service role full access team_members"
  ON team_members FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS for team_invites (similar)
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team admins can view invites"
  ON team_invites FOR SELECT
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );
CREATE POLICY "Team admins can manage invites"
  ON team_invites FOR ALL
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );
CREATE POLICY "Service role full access team_invites"
  ON team_invites FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- enterprise_inquiries: no RLS; backend-only insert via service role
ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can insert enterprise_inquiries"
  ON enterprise_inquiries FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role can select enterprise_inquiries"
  ON enterprise_inquiries FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: free, starter, premium, pro, or enterprise';
