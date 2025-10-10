-- Update ai_logs table schema to match implementation
ALTER TABLE ai_logs 
  ADD COLUMN IF NOT EXISTS function_name text,
  ADD COLUMN IF NOT EXISTS input_hash text,
  ADD COLUMN IF NOT EXISTS output_preview text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'success';

-- Rename total_tokens to tokens_used if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_logs' AND column_name = 'total_tokens'
  ) THEN
    ALTER TABLE ai_logs RENAME COLUMN total_tokens TO tokens_used;
  END IF;
END $$;