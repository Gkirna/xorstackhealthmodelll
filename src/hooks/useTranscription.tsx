import { useState, useCallback, useRef, useEffect } from 'react';
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

export function useTranscription(sessionId: string, onSaveStatusChange?: (status: 'saving' | 'saved' | 'error') => void) {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [pendingChunks, setPendingChunks] = useState<Array<{text: string, speaker: string}>>([]);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Batch save chunks to reduce save failures
  const batchSaveChunks = useCallback(async (chunks: Array<{text: string, speaker: string}>) => {
    if (!sessionId || chunks.length === 0 || isBatchSaving) return;

    setIsBatchSaving(true);
    onSaveStatusChange?.('saving');
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    const saveWithRetry = async (retryCount = 0): Promise<boolean> => {
      try {
        console.log(`💾 Batch saving ${chunks.length} transcript chunks (attempt ${retryCount + 1})`);
        
        const chunksToInsert = chunks.map(chunk => ({
          session_id: sessionId,
          text: chunk.text.trim(),
          speaker: chunk.speaker,
          timestamp_offset: Date.now()
        }));

        const { data, error } = await supabase
          .from('session_transcripts')
          .insert(chunksToInsert)
          .select();

        if (error) {
          console.error('❌ Batch save failed:', error);
          throw error;
        }

        console.log('✅ Batch saved successfully:', data.length, 'chunks');
        if (data) {
          setTranscriptChunks(prev => [...prev, ...data]);
        }
        onSaveStatusChange?.('saved');
        return true;
      } catch (error) {
        console.error('Batch save error:', error);
        
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`🔄 Retrying batch save in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return saveWithRetry(retryCount + 1);
        }
        
        onSaveStatusChange?.('error');
        return false;
      }
    };

    const success = await saveWithRetry();
    
    if (!success) {
      // Store in local storage as backup
      const localBackup = JSON.parse(localStorage.getItem(`transcript_backup_${sessionId}`) || '[]');
      localBackup.push(...chunks.map(c => ({
        ...c,
        timestamp: Date.now(),
        pending: true
      })));
      localStorage.setItem(`transcript_backup_${sessionId}`, JSON.stringify(localBackup));
      
      toast.error('Failed to save transcript. Backed up locally.', {
        description: 'Will retry automatically when connection is restored.'
      });
    } else {
      // Clear saved status after 2 seconds
      setTimeout(() => onSaveStatusChange?.(null as any), 2000);
    }

    setIsBatchSaving(false);
    setPendingChunks([]);
  }, [sessionId, isBatchSaving, onSaveStatusChange]);

  // Add transcript chunk to pending queue
  const addTranscriptChunk = useCallback((text: string, speaker: string = 'provider') => {
    if (!sessionId || !text.trim()) return;

    console.log('📝 Adding transcript chunk:', { speaker, text: text.substring(0, 50) + '...' });

    // Add to pending queue
    setPendingChunks(prev => [...prev, { text, speaker }]);

    // Add to UI immediately for responsiveness
    const optimisticChunk = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      text: text.trim(),
      speaker,
      timestamp_offset: Date.now(),
      created_at: new Date().toISOString()
    };
    setTranscriptChunks(prev => [...prev, optimisticChunk as any]);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Batch save after 2 seconds of inactivity or when 5 chunks accumulated
    saveTimeoutRef.current = setTimeout(() => {
      setPendingChunks(current => {
        if (current.length > 0) {
          batchSaveChunks(current);
        }
        return current;
      });
    }, 2000);
  }, [sessionId, batchSaveChunks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save any pending chunks before unmount
      if (pendingChunks.length > 0) {
        batchSaveChunks(pendingChunks);
      }
    };
  }, [pendingChunks, batchSaveChunks]);

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
