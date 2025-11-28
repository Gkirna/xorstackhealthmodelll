-- Fix materialized view security: Create secure access function
-- Drop the materialized view from public API by revoking access
REVOKE ALL ON public.user_analytics FROM anon, authenticated;

-- Grant access only to specific roles
GRANT SELECT ON public.user_analytics TO service_role;

-- Create secure function to access analytics (RLS enforced)
CREATE OR REPLACE FUNCTION public.get_user_analytics(target_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  total_sessions bigint,
  completed_sessions bigint,
  total_words_transcribed bigint,
  avg_transcript_quality numeric,
  total_transcription_time bigint,
  total_tasks bigint,
  completed_tasks bigint,
  last_session_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requesting_user_id uuid := auth.uid();
BEGIN
  -- Check if user is requesting their own data or is admin
  IF target_user_id IS NULL THEN
    target_user_id := requesting_user_id;
  END IF;

  IF target_user_id != requesting_user_id AND NOT has_role(requesting_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized access to analytics';
  END IF;

  RETURN QUERY
  SELECT 
    ua.user_id,
    ua.total_sessions,
    ua.completed_sessions,
    ua.total_words_transcribed,
    ua.avg_transcript_quality,
    ua.total_transcription_time,
    ua.total_tasks,
    ua.completed_tasks,
    ua.last_session_date
  FROM public.user_analytics ua
  WHERE ua.user_id = target_user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_analytics(uuid) TO authenticated;