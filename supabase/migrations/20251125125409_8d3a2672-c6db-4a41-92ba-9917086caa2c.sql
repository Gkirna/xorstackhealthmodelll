-- Fix security issues from previous migration

-- 1. Fix function search_path (SECURITY)
CREATE OR REPLACE FUNCTION refresh_session_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY session_analytics;
END;
$$;

-- 2. Restrict materialized view access (not exposed via API)
-- Revoke default public access
REVOKE ALL ON session_analytics FROM PUBLIC;
REVOKE ALL ON session_analytics FROM anon;
REVOKE ALL ON session_analytics FROM authenticated;

-- Grant only to service role for internal analytics
-- (This view should only be used by admin dashboards, not exposed via PostgREST API)

COMMENT ON MATERIALIZED VIEW session_analytics IS 'Internal analytics view - NOT exposed via API. Access restricted to service role only.';