-- Add performance indexes for transcription queries
-- These dramatically improve query performance for large datasets

-- Index for fetching session transcripts by session_id (most common query)
CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id 
ON public.session_transcripts(session_id, created_at DESC);

-- Index for speaker filtering and analysis
CREATE INDEX IF NOT EXISTS idx_session_transcripts_speaker 
ON public.session_transcripts(speaker, session_id);

-- Index for AI logs by user and operation type (audit queries)
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_operation 
ON public.ai_logs(user_id, operation_type, created_at DESC);

-- Index for AI logs by session (session analytics)
CREATE INDEX IF NOT EXISTS idx_ai_logs_session 
ON public.ai_logs(session_id, created_at DESC);

-- Index for sessions by user and status (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sessions_user_status 
ON public.sessions(user_id, status, created_at DESC);

-- Add transcript quality metrics column
ALTER TABLE public.session_transcripts 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT FALSE;

-- Add session quality metrics
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS transcript_quality_avg DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS total_words INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS transcription_duration_seconds INTEGER;

-- Create materialized view for session analytics (fast dashboard queries)
CREATE MATERIALIZED VIEW IF NOT EXISTS session_analytics AS
SELECT 
  s.id,
  s.user_id,
  s.status,
  s.created_at,
  COUNT(st.id) as transcript_segments,
  AVG(st.confidence_score) as avg_confidence,
  SUM(LENGTH(st.text)) as total_characters,
  MAX(st.created_at) - MIN(st.created_at) as duration
FROM public.sessions s
LEFT JOIN public.session_transcripts st ON s.id = st.session_id
GROUP BY s.id, s.user_id, s.status, s.created_at;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_session_analytics_user 
ON session_analytics(user_id, created_at DESC);

-- Function to refresh analytics (call after transcript updates)
CREATE OR REPLACE FUNCTION refresh_session_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY session_analytics;
END;
$$;

COMMENT ON MATERIALIZED VIEW session_analytics IS 'Aggregated session metrics for fast dashboard queries. Refresh periodically.';
COMMENT ON FUNCTION refresh_session_analytics IS 'Refresh session analytics materialized view. Call after bulk transcript updates.';