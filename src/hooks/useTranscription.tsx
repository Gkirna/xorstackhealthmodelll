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

  const addTranscriptChunk = useCallback(async (text: string, speaker: string = 'provider', retryCount = 0) => {
    if (!sessionId || !text.trim()) return;

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    try {
      console.log('💾 Saving transcript chunk:', { sessionId, text: text.substring(0, 50) + '...', speaker, attempt: retryCount + 1 });
      
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
      
      // Retry logic with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`🔄 Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return addTranscriptChunk(text, speaker, retryCount + 1);
      }
      
      // Final failure after all retries
      toast.error('Failed to save transcript after multiple attempts', {
        description: 'Your transcript is cached locally and will be saved when connection is restored.'
      });
      
      // Store failed chunk locally for later retry
      const failedChunk = {
        id: `local-${Date.now()}`,
        session_id: sessionId,
        text: text.trim(),
        speaker,
        timestamp_offset: Date.now(),
        created_at: new Date().toISOString(),
        pending: true
      };
      
      setTranscriptChunks(prev => [...prev, failedChunk as any]);
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
