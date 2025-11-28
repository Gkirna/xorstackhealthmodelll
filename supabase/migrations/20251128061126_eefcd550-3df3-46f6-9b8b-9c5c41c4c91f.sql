-- Phase 6: Database Optimization

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id ON public.session_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_speaker ON public.session_transcripts(speaker);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_created_at ON public.session_transcripts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_template_id ON public.sessions(template_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON public.tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_session_id ON public.ai_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_operation_type ON public.ai_logs(operation_type);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create materialized view for dashboard analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_analytics AS
SELECT 
  s.user_id,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions,
  SUM(s.total_words) as total_words_transcribed,
  AVG(s.transcript_quality_avg) as avg_transcript_quality,
  SUM(s.transcription_duration_seconds) as total_transcription_time,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  MAX(s.created_at) as last_session_date
FROM public.sessions s
LEFT JOIN public.tasks t ON t.user_id = s.user_id
GROUP BY s.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics(user_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_user_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics;
END;
$$;

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup of old transcripts (90+ days)
SELECT cron.schedule(
  'cleanup-old-transcripts',
  '0 2 * * *', -- 2 AM daily
  $$
  DELETE FROM public.session_transcripts 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND session_id IN (
    SELECT id FROM public.sessions WHERE status = 'completed'
  );
  $$
);

-- Schedule daily analytics refresh
SELECT cron.schedule(
  'refresh-analytics',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT public.refresh_user_analytics();
  $$
);

-- Schedule weekly cleanup of old AI logs
SELECT cron.schedule(
  'cleanup-old-ai-logs',
  '0 4 * * 0', -- 4 AM every Sunday
  $$
  DELETE FROM public.ai_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);

-- Add audit trigger for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.ai_logs (user_id, operation_type, model, status, metadata)
    VALUES (
      OLD.user_id,
      'session_deleted',
      NULL,
      'success',
      jsonb_build_object('session_id', OLD.id, 'patient_name', OLD.patient_name)
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_session_deletion
AFTER DELETE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.log_sensitive_operations();