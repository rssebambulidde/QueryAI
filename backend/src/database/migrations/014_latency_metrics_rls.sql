-- Row Level Security for Latency Metrics Tables

-- Enable RLS on latency_metrics table
ALTER TABLE latency_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own latency metrics
CREATE POLICY "Users can view their own latency metrics"
ON latency_metrics
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to latency metrics"
ON latency_metrics
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Enable RLS on latency_alerts table
ALTER TABLE latency_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access to latency alerts
CREATE POLICY "Service role has full access to latency alerts"
ON latency_alerts
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Comments
COMMENT ON POLICY "Users can view their own latency metrics" ON latency_metrics IS 
'Allows users to view their own latency metrics';

COMMENT ON POLICY "Service role has full access to latency metrics" ON latency_metrics IS 
'Allows service role (backend) to perform all operations on latency metrics';

COMMENT ON POLICY "Service role has full access to latency alerts" ON latency_alerts IS 
'Allows service role (backend) to perform all operations on latency alerts';
