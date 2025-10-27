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

interface PendingChunk {
  text: string;
  speaker: string;
  timestamp: number;
}

export function useTranscription(sessionId: string) {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Queue system for batching inserts
  const pendingChunksRef = useRef<PendingChunk[]>([]);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  
  // Configuration
  const BATCH_SIZE = 5; // Save every 5 chunks
  const DEBOUNCE_MS = 2000; // Save after 2 seconds of inactivity
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const FAILED_CHUNKS_KEY = `failed_transcripts_${sessionId}`;

  // Optimistic UI: Add chunk to local state immediately
  const addChunkToUI = useCallback((text: string, speaker: string, tempId: string) => {
    const tempChunk: any = {
      id: tempId,
      session_id: sessionId,
      text: text.trim(),
      speaker,
      timestamp_offset: Date.now(),
      created_at: new Date().toISOString(),
      pending: true,
      temp: true
    };
    setTranscriptChunks(prev => [...prev, tempChunk]);
    return tempChunk;
  }, [sessionId]);

  // Replace temp chunk with real chunk after DB save
  const replaceTempChunk = useCallback((tempId: string, realChunk: TranscriptChunk) => {
    setTranscriptChunks(prev => 
      prev.map(chunk => chunk.id === tempId ? { ...realChunk, pending: false } : chunk)
    );
  }, []);

  // Batch insert to database
  const savePendingChunks = useCallback(async (chunks: PendingChunk[]) => {
    if (!sessionId || chunks.length === 0 || saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    console.log(`💾 Saving batch of ${chunks.length} transcript chunks...`);

    try {
      const { data, error } = await supabase
        .from('session_transcripts')
        .insert(
          chunks.map(chunk => ({
            session_id: sessionId,
            text: chunk.text.trim(),
            speaker: chunk.speaker,
            timestamp_offset: chunk.timestamp
          }))
        )
        .select();

      if (error) {
        console.error('❌ Batch save failed:', error);
        throw error;
      }

      console.log(`✅ Saved batch of ${data.length} chunks successfully`);
      consecutiveFailuresRef.current = 0;
      
      // Clear localStorage on successful save
      try {
        localStorage.removeItem(FAILED_CHUNKS_KEY);
      } catch (e) {
        console.error('Failed to clear failed chunks:', e);
      }
      
      return data;
    } catch (error: any) {
      console.error('❌ Error saving batch:', error);
      
      // Check if table doesn't exist
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.error('❌ Table session_transcripts does not exist. Please run the migration.');
        toast.error('Database table not found. Please run migrations.', {
          description: 'Transcript is cached locally and will be saved once the database is set up.'
        });
        
        // Store in localStorage for later retry
        try {
          const failedChunks = JSON.parse(localStorage.getItem(FAILED_CHUNKS_KEY) || '[]');
          chunks.forEach(chunk => {
            failedChunks.push({
              id: `local-${Date.now()}-${Math.random()}`,
              session_id: sessionId,
              text: chunk.text.trim(),
              speaker: chunk.speaker,
              timestamp_offset: chunk.timestamp,
              created_at: new Date().toISOString(),
              pending: true
            });
          });
          localStorage.setItem(FAILED_CHUNKS_KEY, JSON.stringify(failedChunks));
        } catch (e) {
          console.error('Failed to cache transcripts:', e);
        }
        
        consecutiveFailuresRef.current++;
        
        // If too many consecutive failures, stop trying
        if (consecutiveFailuresRef.current >= 5) {
          toast.error('Multiple save failures detected. Please check database connection.');
        }
        
        return null;
      }
      
      consecutiveFailuresRef.current++;
      
      // Retry with exponential backoff
      if (consecutiveFailuresRef.current < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, consecutiveFailuresRef.current - 1);
        console.log(`🔄 Retrying batch save in ${delay}ms...`);
        setTimeout(() => {
          savePendingChunks(chunks);
        }, delay);
      }
      
      return null;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [sessionId, FAILED_CHUNKS_KEY]);

  // Process pending chunks queue
  const processQueue = useCallback(async (force = false) => {
    const chunks = pendingChunksRef.current;
    
    // Clear timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Save if queue is full or if forced
    if (chunks.length >= BATCH_SIZE || force) {
      if (chunks.length > 0) {
        const chunksToSave = [...chunks];
        pendingChunksRef.current = [];
        await savePendingChunks(chunksToSave);
      }
    } else if (chunks.length > 0) {
      // Schedule save after debounce period
      saveTimerRef.current = setTimeout(() => {
        processQueue(true);
      }, DEBOUNCE_MS);
    }
  }, [savePendingChunks]);

  // Main function to add transcript chunk
  const addTranscriptChunk = useCallback(async (text: string, speaker: string = 'provider', retryCount = 0) => {
    if (!sessionId || !text.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Optimistic UI update - show immediately
    addChunkToUI(text, speaker, tempId);
    
    // Add to queue
    pendingChunksRef.current.push({
      text: text.trim(),
      speaker,
      timestamp: Date.now()
    });
    
    // Process queue
    await processQueue();
    
    return { id: tempId, session_id: sessionId, text: text.trim(), speaker };
  }, [sessionId, addChunkToUI, processQueue]);

  // Force save all pending chunks (call when stopping recording)
  const saveAllPendingChunks = useCallback(async () => {
    if (pendingChunksRef.current.length > 0) {
      console.log('💾 Force saving all pending chunks...');
      await processQueue(true);
    }
  }, [processQueue]);

  // Load transcripts from database
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
      console.log(`✅ Loaded ${data?.length || 0} transcript chunks from database`);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  }, [sessionId]);

  // Get full transcript text
  const getFullTranscript = useCallback(() => {
    return transcriptChunks
      .filter(chunk => !chunk.temp) // Exclude temporary chunks
      .map(chunk => {
        const speakerLabel = chunk.speaker === 'provider' ? 'Doctor' : 'Patient';
        return `**${speakerLabel}:** ${chunk.text}`;
      })
      .join('\n\n');
  }, [transcriptChunks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Auto-save when recording stops
  useEffect(() => {
    if (!isTranscribing && pendingChunksRef.current.length > 0) {
      saveAllPendingChunks();
    }
  }, [isTranscribing, saveAllPendingChunks]);

  return {
    transcriptChunks,
    isTranscribing,
    setIsTranscribing,
    addTranscriptChunk,
    loadTranscripts,
    getFullTranscript,
    saveAllPendingChunks,
  };
}