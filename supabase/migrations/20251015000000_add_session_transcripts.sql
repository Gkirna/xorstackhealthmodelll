-- Create session_transcripts table for live transcription support
CREATE TABLE IF NOT EXISTS public.session_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  speaker TEXT NOT NULL,
  timestamp_offset BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id ON public.session_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_timestamp ON public.session_transcripts(timestamp_offset);

-- Enable RLS on session_transcripts
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_transcripts
-- Users can view transcripts for their own sessions
CREATE POLICY "Users can view their own session transcripts"
ON public.session_transcripts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id
    AND sessions.user_id = auth.uid()
  )
);

-- Users can insert transcripts for their own sessions
CREATE POLICY "Users can insert transcripts for their own sessions"
ON public.session_transcripts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id
    AND sessions.user_id = auth.uid()
  )
);

-- Users can update transcripts for their own sessions
CREATE POLICY "Users can update their own session transcripts"
ON public.session_transcripts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id
    AND sessions.user_id = auth.uid()
  )
);

-- Users can delete transcripts for their own sessions
CREATE POLICY "Users can delete their own session transcripts"
ON public.session_transcripts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id
    AND sessions.user_id = auth.uid()
  )
);

