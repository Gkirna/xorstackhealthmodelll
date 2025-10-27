import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;
  timestamp_offset: number;
  created_at: string;
  confidence?: number;
  temp?: boolean;
  pending?: boolean;
}

interface TranscriptionStats {
  doctorChunks: number;
  patientChunks: number;
  totalWords: number;
  totalChars: number;
  duration: number;
}

export function useRealTimeTranscription(sessionId: string) {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState<TranscriptionStats>({
    doctorChunks: 0,
    patientChunks: 0,
    totalWords: 0,
    totalChars: 0,
    duration: 0,
  });
  
  // Queue system with refs to prevent re-renders
  const pendingChunksRef = useRef<Map<string, { text: string; speaker: string; timestamp: number }>>(new Map());
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());
  
  // Configuration
  const BATCH_SIZE = 5;
  const DEBOUNCE_MS = 2000;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const FAILED_CHUNKS_KEY = `failed_transcripts_${sessionId}`;
  const SAVE_QUEUE_CHECK_INTERVAL = 1000; // Check queue every second

  // Calculate real-time stats from chunks
  const calculateStats = useCallback((chunks: TranscriptChunk[]) => {
    const doctorChunks = chunks.filter(c => c.speaker === 'provider').length;
    const patientChunks = chunks.filter(c => c.speaker === 'patient').length;
    const allText = chunks.map(c => c.text).join(' ');
    const totalWords = allText.trim().split(/\s+/).filter(Boolean).length;
    const totalChars = allText.length;
    const duration = Date.now() - startTimeRef.current;
    
    return { doctorChunks, patientChunks, totalWords, totalChars, duration };
  }, []);

  // Update stats when chunks change
  useEffect(() => {
    setStats(calculateStats(transcriptChunks));
  }, [transcriptChunks, calculateStats]);

  // Optimistic UI: Add chunk immediately with unique ID
  const addChunkToUI = useCallback((text: string, speaker: string) => {
    const timestamp = Date.now();
    const tempId = `temp-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempChunk: TranscriptChunk = {
      id: tempId,
      session_id: sessionId,
      text: text.trim(),
      speaker,
      timestamp_offset: timestamp,
      created_at: new Date().toISOString(),
      pending: true,
      temp: true
    };
    
    setTranscriptChunks(prev => {
      const updated = [...prev, tempChunk];
      // Sort by timestamp
      return updated.sort((a, b) => a.timestamp_offset - b.timestamp_offset);
    });
    
    return { tempId, timestamp };
  }, [sessionId]);

  // Batch insert with retry and error handling
  const savePendingChunks = useCallback(async (chunks: Array<{ text: string; speaker: string; timestamp: number }>, attempt = 0) => {
    if (!sessionId || chunks.length === 0 || saveInProgressRef.current) {
      return;
    }

    if (attempt > 0) {
      console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`);
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
        
        // Check if table doesn't exist
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.error('❌ Table session_transcripts does not exist. Please run the migration.');
          
          // Store in localStorage for later retry
          try {
            const existingFailed = JSON.parse(localStorage.getItem(FAILED_CHUNKS_KEY) || '[]');
            chunks.forEach(chunk => {
              existingFailed.push({
                id: `local-${Date.now()}-${Math.random()}`,
                session_id: sessionId,
                text: chunk.text.trim(),
                speaker: chunk.speaker,
                timestamp_offset: chunk.timestamp,
                created_at: new Date().toISOString(),
                pending: true
              });
            });
            localStorage.setItem(FAILED_CHUNKS_KEY, JSON.stringify(existingFailed));
            
            if (attempt === 0) {
              toast.error('Database table missing. Run migrations.', {
                description: 'Transcript cached locally for later save.'
              });
            }
          } catch (e) {
            console.error('Failed to cache transcripts:', e);
          }
          
          consecutiveFailuresRef.current++;
          
          if (consecutiveFailuresRef.current >= 5) {
            toast.error('Multiple save failures. Check connection.');
          }
          
          saveInProgressRef.current = false;
          return null;
        }
        
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
      
      // Replace temp chunks with real chunks in UI
      const tempIds = chunks.map((_, idx) => `temp-${Date.now()}-${idx}`);
      setTranscriptChunks(prev => {
        return prev.map(chunk => {
          const realChunk = data.find((d: TranscriptChunk, idx: number) => 
            chunk.id.startsWith('temp') && idx < tempIds.length
          );
          return realChunk || chunk;
        }).filter((chunk, idx, arr) => 
          !chunk.temp || arr.findIndex(c => c.id === chunk.id) === idx
        );
      });
      
      saveInProgressRef.current = false;
      return data;
    } catch (error: any) {
      console.error('❌ Error saving batch:', error);
      consecutiveFailuresRef.current++;
      saveInProgressRef.current = false;
      
      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        console.log(`🔄 Retrying in ${delay}ms...`);
        setTimeout(() => {
          savePendingChunks(chunks, attempt + 1);
        }, delay);
      } else {
        toast.error('Failed to save transcripts after multiple attempts', {
          description: 'Your transcript is cached locally and will be saved when connection is restored.'
        });
      }
      
      return null;
    }
  }, [sessionId, FAILED_CHUNKS_KEY, MAX_RETRIES, RETRY_DELAY]);

  // Process queue periodically
  const processQueue = useCallback(() => {
    const chunks = Array.from(pendingChunksRef.current.values());
    
    // Clear timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Save if queue has enough chunks
    if (chunks.length >= BATCH_SIZE) {
      const chunksToSave = chunks.slice(0, BATCH_SIZE);
      pendingChunksRef.current.clear();
      pendingChunksRef.current = new Map(Array.from(pendingChunksRef.current.entries()).slice(BATCH_SIZE));
      savePendingChunks(chunksToSave);
    } else if (chunks.length > 0) {
      // Schedule save after debounce period
      saveTimerRef.current = setTimeout(() => {
        const chunksToSave = Array.from(pendingChunksRef.current.values());
        pendingChunksRef.current.clear();
        savePendingChunks(chunksToSave);
      }, DEBOUNCE_MS);
    }
  }, [savePendingChunks]);

  // Periodic queue processor
  useEffect(() => {
    const interval = setInterval(() => {
      if (!saveInProgressRef.current && pendingChunksRef.current.size > 0) {
        processQueue();
      }
    }, SAVE_QUEUE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [processQueue]);

  // Add transcript chunk - optimized for real-time
  const addTranscriptChunk = useCallback((text: string, speaker: string = 'provider') => {
    if (!sessionId || !text.trim()) return;

    // Optimistic UI update
    const { tempId, timestamp } = addChunkToUI(text, speaker);
    
    // Add to queue
    pendingChunksRef.current.set(tempId, {
      text: text.trim(),
      speaker,
      timestamp
    });
    
    // Trigger queue processing (will debounce/batch automatically)
    processQueue();
    
    return { id: tempId, session_id: sessionId, text: text.trim(), speaker };
  }, [sessionId, addChunkToUI, processQueue]);

  // Force save all pending chunks
  const saveAllPendingChunks = useCallback(async () => {
    const chunks = Array.from(pendingChunksRef.current.values());
    if (chunks.length > 0) {
      console.log('💾 Force saving all pending chunks...');
      pendingChunksRef.current.clear();
      await savePendingChunks(chunks);
    }
  }, [savePendingChunks]);

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
      startTimeRef.current = data && data.length > 0 
        ? data[0].timestamp_offset 
        : Date.now();
        
      console.log(`✅ Loaded ${data?.length || 0} transcript chunks from database`);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  }, [sessionId]);

  // Get transcripts by speaker with memoization
  const getDoctorTranscripts = useMemo(() => {
    return transcriptChunks
      .filter(chunk => chunk.speaker === 'provider')
      .map(chunk => chunk.text)
      .join('\n\n');
  }, [transcriptChunks]);

  const getPatientTranscripts = useMemo(() => {
    return transcriptChunks
      .filter(chunk => chunk.speaker === 'patient')
      .map(chunk => chunk.text)
      .join('\n\n');
  }, [transcriptChunks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // Save any remaining chunks
      saveAllPendingChunks();
    };
  }, [saveAllPendingChunks]);

  // Auto-save when recording stops
  useEffect(() => {
    if (!isTranscribing && pendingChunksRef.current.size > 0) {
      saveAllPendingChunks();
    }
  }, [isTranscribing, saveAllPendingChunks]);

  return {
    transcriptChunks,
    isTranscribing,
    isActive,
    stats,
    setIsTranscribing,
    setActive: setIsActive,
    addTranscriptChunk,
    loadTranscripts,
    saveAllPendingChunks,
    getDoctorTranscripts,
    getPatientTranscripts,
  };
}

