-- Row Level Security for Quality Metrics Table

-- Enable RLS on quality_metrics table
ALTER TABLE quality_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own quality metrics
CREATE POLICY "Users can view their own quality metrics"
ON quality_metrics
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own quality metrics
CREATE POLICY "Users can insert their own quality metrics"
ON quality_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to quality metrics"
ON quality_metrics
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Comments
COMMENT ON POLICY "Users can view their own quality metrics" ON quality_metrics IS 
'Allows users to view only their own quality metrics';

COMMENT ON POLICY "Users can insert their own quality metrics" ON quality_metrics IS 
'Allows users to insert quality metrics for their own queries';

COMMENT ON POLICY "Service role has full access to quality metrics" ON quality_metrics IS 
'Allows service role (backend) to perform all operations on quality metrics';
