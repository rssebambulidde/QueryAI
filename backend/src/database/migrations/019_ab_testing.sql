-- A/B Testing Tables
-- Tables for A/B testing framework

-- A/B Tests table
CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  feature TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  min_sample_size INTEGER DEFAULT 100,
  significance_level NUMERIC DEFAULT 0.05,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A/B Test Assignments table
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(test_id, user_id, query_id)
);

-- A/B Test Results table
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  metrics JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_feature ON ab_tests(feature);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_user ON ab_test_assignments(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_query ON ab_test_assignments(test_id, query_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_test ON ab_test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_variant ON ab_test_results(test_id, variant);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_timestamp ON ab_test_results(timestamp);

-- RLS Policies
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY ab_tests_admin_all ON ab_tests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY ab_test_assignments_admin_all ON ab_test_assignments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY ab_test_results_admin_all ON ab_test_results
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can read their own assignments and results
CREATE POLICY ab_test_assignments_user_read ON ab_test_assignments
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY ab_test_results_user_read ON ab_test_results
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY ab_tests_service_all ON ab_tests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY ab_test_assignments_service_all ON ab_test_assignments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY ab_test_results_service_all ON ab_test_results
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
