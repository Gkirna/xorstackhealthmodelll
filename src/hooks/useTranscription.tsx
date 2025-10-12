import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;
  timestamp_offset: number;
  created_at: string;
}

export function useTranscription(sessionId: string) {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const addTranscriptChunk = useCallback(async (text: string, speaker: string = 'provider') => {
    if (!sessionId || !text.trim()) return;

    try {
      console.log('💾 Saving transcript chunk:', { sessionId, text: text.substring(0, 50) + '...', speaker });
      
      const { data, error } = await supabase
        .from('session_transcripts')
        .insert({
          session_id: sessionId,
          text: text.trim(),
          speaker,
          timestamp_offset: Date.now()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to save transcript:', error);
        throw error;
      }

      console.log('✅ Transcript saved successfully');
      setTranscriptChunks(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error adding transcript chunk:', error);
      toast.error('Failed to save transcript');
    }
  }, [sessionId]);

  const loadTranscripts = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('session_transcripts')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_offset', { ascending: true });

      if (error) throw error;
      
      setTranscriptChunks(data || []);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  }, [sessionId]);

  const getFullTranscript = useCallback(() => {
    return transcriptChunks.map(chunk => chunk.text).join('\n\n');
  }, [transcriptChunks]);

  return {
    transcriptChunks,
    isTranscribing,
    setIsTranscribing,
    addTranscriptChunk,
    loadTranscripts,
    getFullTranscript
  };
}
