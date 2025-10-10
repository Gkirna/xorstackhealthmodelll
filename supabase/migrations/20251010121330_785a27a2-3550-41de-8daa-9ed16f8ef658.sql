-- Add missing columns to sessions table
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS appointment_type TEXT,
  ADD COLUMN IF NOT EXISTS input_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL;

-- Update session_transcripts table to use correct column name
ALTER TABLE public.session_transcripts
  RENAME COLUMN timestamp_ms TO timestamp_offset;

-- Add missing columns to templates table
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS structure JSONB,
  ADD COLUMN IF NOT EXISTS is_community BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update the is_shared column to match is_community for backwards compatibility
UPDATE public.templates SET is_community = is_shared WHERE is_community IS NULL;