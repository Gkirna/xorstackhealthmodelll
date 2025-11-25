-- Fix duration_ms column overflow in ai_logs
-- The column was storing timestamps instead of durations, causing integer overflow

ALTER TABLE public.ai_logs 
ALTER COLUMN duration_ms TYPE BIGINT;

COMMENT ON COLUMN public.ai_logs.duration_ms IS 'Processing duration in milliseconds (not a timestamp)';