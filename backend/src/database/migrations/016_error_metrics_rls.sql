-- Row Level Security for Error Metrics Tables

-- Enable RLS on error_metrics table
ALTER TABLE error_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own error metrics
CREATE POLICY "Users can view their own error metrics"
ON error_metrics
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to error metrics"
ON error_metrics
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Enable RLS on error_rate_alerts table
ALTER TABLE error_rate_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access to error rate alerts
CREATE POLICY "Service role has full access to error rate alerts"
ON error_rate_alerts
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Comments
COMMENT ON POLICY "Users can view their own error metrics" ON error_metrics IS 
'Allows users to view their own error metrics';

COMMENT ON POLICY "Service role has full access to error metrics" ON error_metrics IS 
'Allows service role (backend) to perform all operations on error metrics';

COMMENT ON POLICY "Service role has full access to error rate alerts" ON error_rate_alerts IS 
'Allows service role (backend) to perform all operations on error rate alerts';
