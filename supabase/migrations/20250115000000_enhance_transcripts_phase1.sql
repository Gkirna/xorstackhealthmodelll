-- Enhanced session_transcripts table for Phase 1 improvements
-- Add confidence scoring and medical NER support

-- Add new columns to session_transcripts table
ALTER TABLE public.session_transcripts 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS asr_provider TEXT DEFAULT 'webspeech',
ADD COLUMN IF NOT EXISTS start_time_ms BIGINT,
ADD COLUMN IF NOT EXISTS end_time_ms BIGINT,
ADD COLUMN IF NOT EXISTS speaker_confidence DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS alternatives JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}'::jsonb;

-- Create medical entities table for NER data
CREATE TABLE IF NOT EXISTS public.medical_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES public.session_transcripts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('medication', 'condition', 'procedure', 'anatomy', 'symptom', 'other')),
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_transcripts_confidence ON public.session_transcripts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_provider ON public.session_transcripts(asr_provider);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_timing ON public.session_transcripts(start_time_ms, end_time_ms);

CREATE INDEX IF NOT EXISTS idx_medical_entities_transcript ON public.medical_entities(transcript_id);
CREATE INDEX IF NOT EXISTS idx_medical_entities_category ON public.medical_entities(category);
CREATE INDEX IF NOT EXISTS idx_medical_entities_confidence ON public.medical_entities(confidence);

-- Enable RLS on medical_entities
ALTER TABLE public.medical_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_entities
-- Users can view medical entities for their own session transcripts
CREATE POLICY "Users can view medical entities for their own transcripts"
ON public.medical_entities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.session_transcripts st
    JOIN public.sessions s ON s.id = st.session_id
    WHERE st.id = medical_entities.transcript_id
    AND s.user_id = auth.uid()
  )
);

-- Users can insert medical entities for their own session transcripts
CREATE POLICY "Users can insert medical entities for their own transcripts"
ON public.medical_entities
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.session_transcripts st
    JOIN public.sessions s ON s.id = st.session_id
    WHERE st.id = medical_entities.transcript_id
    AND s.user_id = auth.uid()
  )
);

-- Users can update medical entities for their own session transcripts
CREATE POLICY "Users can update medical entities for their own transcripts"
ON public.medical_entities
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.session_transcripts st
    JOIN public.sessions s ON s.id = st.session_id
    WHERE st.id = medical_entities.transcript_id
    AND s.user_id = auth.uid()
  )
);

-- Users can delete medical entities for their own session transcripts
CREATE POLICY "Users can delete medical entities for their own transcripts"
ON public.medical_entities
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.session_transcripts st
    JOIN public.sessions s ON s.id = st.session_id
    WHERE st.id = medical_entities.transcript_id
    AND s.user_id = auth.uid()
  )
);

-- Create a view for enhanced transcript data with medical entities
CREATE OR REPLACE VIEW public.enhanced_session_transcripts AS
SELECT 
  st.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', me.id,
        'text', me.text,
        'label', me.label,
        'category', me.category,
        'confidence', me.confidence,
        'start_offset', me.start_offset,
        'end_offset', me.end_offset
      )
    ) FILTER (WHERE me.id IS NOT NULL),
    '[]'::json
  ) as medical_entities
FROM public.session_transcripts st
LEFT JOIN public.medical_entities me ON st.id = me.transcript_id
GROUP BY st.id, st.session_id, st.text, st.speaker, st.timestamp_offset, 
         st.created_at, st.confidence_score, st.asr_provider, 
         st.start_time_ms, st.end_time_ms, st.speaker_confidence, 
         st.alternatives, st.raw_metadata;

-- Grant access to the view
GRANT SELECT ON public.enhanced_session_transcripts TO authenticated;

-- Create function to get transcript statistics
CREATE OR REPLACE FUNCTION public.get_transcript_stats(session_uuid UUID)
RETURNS TABLE (
  total_chunks BIGINT,
  avg_confidence DECIMAL(3,2),
  high_confidence_chunks BIGINT,
  medium_confidence_chunks BIGINT,
  low_confidence_chunks BIGINT,
  total_medical_entities BIGINT,
  entities_by_category JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(st.id) as total_chunks,
    ROUND(AVG(st.confidence_score), 2) as avg_confidence,
    COUNT(CASE WHEN st.confidence_score >= 0.8 THEN 1 END) as high_confidence_chunks,
    COUNT(CASE WHEN st.confidence_score >= 0.6 AND st.confidence_score < 0.8 THEN 1 END) as medium_confidence_chunks,
    COUNT(CASE WHEN st.confidence_score < 0.6 THEN 1 END) as low_confidence_chunks,
    COUNT(me.id) as total_medical_entities,
    COALESCE(
      json_object_agg(
        me.category, 
        COUNT(me.id)
      ) FILTER (WHERE me.category IS NOT NULL),
      '{}'::jsonb
    ) as entities_by_category
  FROM public.session_transcripts st
  LEFT JOIN public.medical_entities me ON st.id = me.transcript_id
  WHERE st.session_id = session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_transcript_stats(UUID) TO authenticated;
