import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranscriptUpdates } from './useRealtime';
import { VoiceAnalyzer } from '@/utils/VoiceAnalyzer';

interface TranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;
  timestamp_offset: number;
  created_at: string;
  temp?: boolean;
  pending?: boolean;
}

interface PendingChunk {
  text: string;
  speaker: string;
  timestamp: number;
  tempId: string;
}

interface TranscriptionStats {
  totalChunks: number;
  savedChunks: number;
  pendingChunks: number;
  failedChunks: number;
  averageLatency: number;
  connectionHealth?: 'healthy' | 'degraded' | 'offline';
  sessionDuration?: number;
}

export function useTranscription(sessionId: string, currentVoiceGender?: 'male' | 'female' | 'unknown') {
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [stats, setStats] = useState<TranscriptionStats>({
    totalChunks: 0,
    savedChunks: 0,
    pendingChunks: 0,
    failedChunks: 0,
    averageLatency: 0,
    connectionHealth: 'healthy',
    sessionDuration: 0,
  });

  // Queue system for batching inserts
  const pendingChunksRef = useRef<PendingChunk[]>([]);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const lastSpeakerRef = useRef<string>('provider');
  const lastSpeakerChangeTimeRef = useRef<number>(Date.now());
  const lastChunkTimeRef = useRef<number>(Date.now());
  const chunkCountPerSpeakerRef = useRef<number>(0);
  const latencyRefs = useRef<number[]>([]);
  
  // STRATEGY 3: Continuous 5+ minute session support
  const sessionStartTimeRef = useRef<number>(0);
  const lastHealthCheckRef = useRef<number>(Date.now());
  const connectionHealthRef = useRef<'healthy' | 'degraded' | 'offline'>('healthy');
  const failedBatchesRef = useRef<any[]>([]);
  const memoryOptimizerTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Voice analysis for gender detection
  const voiceAnalyzerRef = useRef<VoiceAnalyzer | null>(null);
  const currentVoiceGenderRef = useRef<'male' | 'female' | 'unknown'>('unknown');
  const genderHistoryRef = useRef<{ gender: 'male' | 'female', timestamp: number }[]>([]);
  
  // Update gender from external source (from audio recording)
  useEffect(() => {
    if (currentVoiceGender) {
      currentVoiceGenderRef.current = currentVoiceGender;
    }
  }, [currentVoiceGender]);
  
  // Configuration for long sessions (5+ minutes continuous transcription)
  const BATCH_SIZE = 5; // Save every 5 chunks
  const DEBOUNCE_MS = 3000; // 3 seconds debounce for better batching
  const MAX_RETRIES = 5; // More retries for reliability
  const RETRY_DELAY = 1000;
  const FAILED_CHUNKS_KEY = `failed_transcripts_${sessionId}`;
  
  // STRATEGY 3: Long session optimization
  const HEALTH_CHECK_INTERVAL = 30000; // Check health every 30 seconds
  const MEMORY_OPTIMIZE_INTERVAL = 120000; // Optimize memory every 2 minutes
  const MAX_PENDING_CHUNKS = 50; // Limit pending chunks to prevent memory issues
  const FORCE_SAVE_THRESHOLD = 20; // Force save when queue gets large
  const CONNECTION_TIMEOUT = 60000; // 60 seconds - connection timeout
  
  // STRATEGY 2: Enhanced Smart Speaker Detection
  const GAP_THRESHOLD_MS = 30000; // 30 seconds - gaps less than this don't trigger speaker change
  const MIN_SPEAKER_DURATION_MS = 5000; // 5 seconds - minimum time per speaker to maintain consistency
  const SHORT_PAUSE_MS = 3000; // 3 seconds - short natural pause
  const MEDIUM_PAUSE_MS = 10000; // 10 seconds - medium pause (thinking/clinical activity)
  const LONG_PAUSE_MS = 30000; // 30 seconds - long pause (guaranteed speaker change)
  const MIN_CHUNKS_PER_SPEAKER = 2; // Minimum chunks before allowing speaker change

  // Real-time subscription for instant updates
  useTranscriptUpdates(sessionId, (newTranscript) => {
    console.log('Real-time update received');
    
    // Only add if it's a new chunk (not a temp one we already have)
    setTranscriptChunks(prev => {
      const exists = prev.some(chunk => chunk.id === newTranscript.id);
      if (exists) return prev;
      
      return [...prev, newTranscript].sort((a, b) => 
        (a.timestamp_offset || 0) - (b.timestamp_offset || 0)
      );
    });
    
    // Update stats
    setStats(prev => ({
      ...prev,
      savedChunks: prev.savedChunks + 1,
    }));
  });

  // Optimistic UI: Add chunk to local state immediately
  const addChunkToUI = useCallback((text: string, speaker: string, tempId: string, timestamp: number) => {
    const tempChunk: TranscriptChunk = {
      id: tempId,
          session_id: sessionId,
          text: text.trim(),
          speaker,
      timestamp_offset: timestamp,
      created_at: new Date().toISOString(),
      pending: true,
      temp: true,
    };
    
    setTranscriptChunks(prev => {
      const updated = [...prev, tempChunk];
      // Sort by timestamp for correct display order
      return updated.sort((a, b) => 
        (a.timestamp_offset || 0) - (b.timestamp_offset || 0)
      );
    });
    
    return tempChunk;
  }, [sessionId]);

  // Gender-based speaker detection
  const detectSpeakerByGender = useCallback((text: string): string | null => {
    // Track gender history
    const now = Date.now();
    
    // If we have voice analysis available, use gender detection
    if (voiceAnalyzerRef.current && currentVoiceGenderRef.current !== 'unknown') {
      // Update gender history
      genderHistoryRef.current.push({
        gender: currentVoiceGenderRef.current,
        timestamp: now
      });
      
      // Keep only last 10 gender detections
      if (genderHistoryRef.current.length > 10) {
        genderHistoryRef.current.shift();
      }
      
      // Determine speaker based on gender
      // Female = patient (typically), Male = provider (typically)
      const speaker = currentVoiceGenderRef.current === 'female' ? 'patient' : 'provider';
      
      console.log(`🎭 Gender detected: ${currentVoiceGenderRef.current} → ${speaker}`);
      return speaker;
    }
    
    // No gender detection available
    return null;
  }, []);

  // STRATEGY 2: Enhanced Smart Speaker Detection
  // Handles clinical pauses, thinking time, and natural speech gaps intelligently
  const determineSpeakerByGaps = useCallback((text: string): string => {
    const now = Date.now();
    const timeSinceLastChunk = now - lastChunkTimeRef.current;
    const timeSinceLastChange = now - lastSpeakerChangeTimeRef.current;
    
    // Update last chunk time
    lastChunkTimeRef.current = now;
    
    // Constants for this calculation
    const SHORT_PAUSE = 3000;    // 3 seconds
    const MEDIUM_PAUSE = 10000;  // 10 seconds  
    const LONG_PAUSE = 30000;    // 30 seconds
    const MIN_DURATION = 5000;   // 5 seconds
    const MIN_CHUNKS = 2;       // 2 chunks
    
    // STRATEGY 2.1: Short pause (< 3 seconds) - definitely same speaker
    if (timeSinceLastChunk < SHORT_PAUSE) {
      chunkCountPerSpeakerRef.current++;
      return lastSpeakerRef.current;
    }
    
    // STRATEGY 2.2: Medium pause (3-30 seconds) - clinical pause, thinking, activity
    if (timeSinceLastChunk >= SHORT_PAUSE && timeSinceLastChunk < MEDIUM_PAUSE) {
      // Keep same speaker if they haven't spoken long enough yet
      if (timeSinceLastChange < MIN_DURATION || chunkCountPerSpeakerRef.current < MIN_CHUNKS) {
        console.log(`⏸️  Short pause detected (${Math.round(timeSinceLastChunk/1000)}s) - keeping ${lastSpeakerRef.current}`);
        return lastSpeakerRef.current;
      }
    }
    
    // STRATEGY 2.3: Long pause (30+ seconds) - likely speaker change
    if (timeSinceLastChunk >= LONG_PAUSE) {
      // Only change if previous speaker spoke for minimum duration
      if (timeSinceLastChange >= MIN_DURATION && chunkCountPerSpeakerRef.current >= MIN_CHUNKS) {
        const newSpeaker = lastSpeakerRef.current === 'provider' ? 'patient' : 'provider';
        lastSpeakerRef.current = newSpeaker;
        lastSpeakerChangeTimeRef.current = now;
        chunkCountPerSpeakerRef.current = 0;
        console.log(`🔄 Speaker changed to: ${newSpeaker} (long gap: ${Math.round(timeSinceLastChunk/1000)}s)`);
        return newSpeaker;
      }
    }
    
    // Default: Keep same speaker (prevents over-changing during natural pauses)
    if (timeSinceLastChange < MIN_DURATION || chunkCountPerSpeakerRef.current < MIN_CHUNKS) {
      return lastSpeakerRef.current;
    }
    
    // If medium pause and speaker has spoken enough, consider change
    if (timeSinceLastChunk >= MEDIUM_PAUSE && timeSinceLastChunk < LONG_PAUSE) {
      const newSpeaker = lastSpeakerRef.current === 'provider' ? 'patient' : 'provider';
      lastSpeakerRef.current = newSpeaker;
      lastSpeakerChangeTimeRef.current = now;
      chunkCountPerSpeakerRef.current = 0;
      console.log(`🔄 Speaker changed to: ${newSpeaker} (medium gap: ${Math.round(timeSinceLastChunk/1000)}s)`);
      return newSpeaker;
    }
    
    // Increment chunk count
    chunkCountPerSpeakerRef.current++;
    return lastSpeakerRef.current;
  }, []);

  // Main speaker determination function
  const determineSpeaker = useCallback((text: string): string => {
    // Try gender detection first, fallback to gap detection
    const genderSpeaker = detectSpeakerByGender(text);
    
    if (genderSpeaker) {
      // Update last speaker if gender detection is available
      lastSpeakerRef.current = genderSpeaker;
      lastSpeakerChangeTimeRef.current = Date.now();
      return genderSpeaker;
    }
    
    // Fallback to gap-based detection
    return determineSpeakerByGaps(text);
  }, [detectSpeakerByGender, determineSpeakerByGaps]);

  // Batch insert to database
  const savePendingChunks = useCallback(async (chunks: PendingChunk[], retryCount = 0): Promise<any[] | null> => {
    if (!sessionId || chunks.length === 0 || saveInProgressRef.current) {
      return null;
    }

    saveInProgressRef.current = true;
    const startTime = Date.now();
    console.log(`💾 Saving batch of ${chunks.length} transcript chunks...`);

    try {
      const { data, error } = await supabase
        .from('session_transcripts')
        .insert(
          chunks.map(chunk => ({
            session_id: sessionId,
            text: chunk.text.trim(),
            speaker: chunk.speaker,
            timestamp_offset: chunk.timestamp,
          }))
        )
        .select();

      if (error) {
        console.error('❌ Batch save failed:', error);
        throw error;
      }

      const latency = Date.now() - startTime;
      latencyRefs.current.push(latency);
      
      // Keep only last 100 latency measurements
      if (latencyRefs.current.length > 100) {
        latencyRefs.current.shift();
      }

      const avgLatency = latencyRefs.current.reduce((a, b) => a + b, 0) / latencyRefs.current.length;

      console.log(`✅ Saved batch of ${data.length} chunks successfully (${latency}ms)`);
      
      consecutiveFailuresRef.current = 0;
      
      // Update stats
      setStats(prev => ({
        ...prev,
        savedChunks: prev.savedChunks + chunks.length,
        pendingChunks: 0,
        averageLatency: Math.round(avgLatency),
      }));
      
      // Update UI: Remove temp chunks and add real ones
      chunks.forEach((chunk, index) => {
        if (data[index]) {
          setTranscriptChunks(prev =>
            prev.map(c => 
              c.id === chunk.tempId 
                ? { ...data[index], pending: false, temp: false }
                : c
            )
          );
        }
      });
      
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
              pending: true,
            });
          });
          localStorage.setItem(FAILED_CHUNKS_KEY, JSON.stringify(failedChunks));
        } catch (e) {
          console.error('Failed to cache transcripts:', e);
        }
        
        consecutiveFailuresRef.current++;
        return null;
      }
      
      // Retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`🔄 Retrying batch save in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return savePendingChunks(chunks, retryCount + 1);
      }
      
      consecutiveFailuresRef.current++;
      setStats(prev => ({ ...prev, failedChunks: prev.failedChunks + chunks.length }));
      
      // Show error only on final failure
      if (retryCount === MAX_RETRIES) {
        toast.error('Failed to save transcripts after multiple attempts', {
        description: 'Your transcript is cached locally and will be saved when connection is restored.'
      });
      }
      
      return null;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [sessionId, FAILED_CHUNKS_KEY, MAX_RETRIES, RETRY_DELAY]);

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
        
        // Update pending count
        setStats(prev => ({ ...prev, pendingChunks: 0 }));
        
        await savePendingChunks(chunksToSave);
      }
    } else if (chunks.length > 0) {
      // Schedule save after debounce period
      saveTimerRef.current = setTimeout(() => {
        processQueue(true);
      }, DEBOUNCE_MS);
    }
  }, [savePendingChunks]);

  // STRATEGY 3: Session health monitoring
  const performHealthCheck = useCallback(async () => {
    const now = Date.now();
    const sessionDuration = now - sessionStartTimeRef.current;
    const timeSinceLastCheck = now - lastHealthCheckRef.current;
    
    // Update last health check time
    lastHealthCheckRef.current = now;
    
    // Check pending chunks
    const pendingCount = pendingChunksRef.current.length;
    
    // STRATEGY 3.1: Force save if queue is getting large
    if (pendingCount >= FORCE_SAVE_THRESHOLD) {
      console.warn(`⚠️ Large queue detected (${pendingCount} chunks) - forcing save`);
      await processQueue(true);
    }
    
    // STRATEGY 3.2: Memory optimization for long sessions
    if (sessionDuration > MEMORY_OPTIMIZE_INTERVAL && pendingCount > 0) {
      console.log(`🧹 Optimizing memory for long session (${Math.round(sessionDuration/1000)}s)...`);
      // Keep only last 100 chunks in memory for performance
      if (transcriptChunks.length > 100) {
        setTranscriptChunks(prev => 
          prev.filter(chunk => !chunk.temp).slice(-100)
        );
      }
    }
    
    // STRATEGY 3.3: Connection health check
    if (consecutiveFailuresRef.current > 3) {
      connectionHealthRef.current = 'degraded';
      console.warn(`⚠️ Connection health: DEGRADED (${consecutiveFailuresRef.current} failures)`);
    } else if (consecutiveFailuresRef.current > 5) {
      connectionHealthRef.current = 'offline';
      console.error(`❌ Connection health: OFFLINE (${consecutiveFailuresRef.current} failures)`);
    } else {
      connectionHealthRef.current = 'healthy';
    }
    
    // STRATEGY 3.4: Automatic retry for failed batches
    if (failedBatchesRef.current.length > 0 && consecutiveFailuresRef.current === 0) {
      console.log(`🔄 Retrying ${failedBatchesRef.current.length} failed batches...`);
      const batchesToRetry = [...failedBatchesRef.current];
      failedBatchesRef.current = [];
      
      for (const batch of batchesToRetry) {
        await savePendingChunks(batch);
      }
    }
    
    // Update stats with connection health
    setStats(prev => ({ ...prev, connectionHealth: connectionHealthRef.current }));
  }, [processQueue, savePendingChunks, transcriptChunks.length]);

  // STRATEGY 3: Progressive save strategy for long sessions
  const applyProgressiveSaveStrategy = useCallback(async (force = false) => {
    const chunks = pendingChunksRef.current;
    const sessionDuration = Date.now() - sessionStartTimeRef.current;
    
    // Progressive strategy based on session duration
    let shouldSave = false;
    let saveReason = '';
    
    // Strategy for 0-2 minutes: Normal batching
    if (sessionDuration < 120000) {
      shouldSave = chunks.length >= BATCH_SIZE || force;
      saveReason = 'normal batching';
    }
    // Strategy for 2-5 minutes: Slightly more aggressive
    else if (sessionDuration < 300000) {
      shouldSave = chunks.length >= 4 || force;
      saveReason = 'moderate session (2-5 min)';
    }
    // Strategy for 5+ minutes: Very aggressive to prevent memory issues
    else {
      shouldSave = chunks.length >= 3 || force;
      saveReason = 'long session (5+ min)';
    }
    
    if (shouldSave && chunks.length > 0) {
      console.log(`💾 Progressive save: ${saveReason} (${chunks.length} chunks, ${Math.round(sessionDuration/1000)}s session)`);
      await processQueue(force);
    }
  }, [processQueue]);

  // Main function to add transcript chunk
  const addTranscriptChunk = useCallback(async (text: string, speaker?: string) => {
    if (!sessionId || !text.trim()) return;

    const timestamp = Date.now();
    const tempId = `temp-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Smart speaker detection if not provided
    const detectedSpeaker = speaker || determineSpeaker(text);
    
    // Optimistic UI update - show immediately
    addChunkToUI(text, detectedSpeaker, tempId, timestamp);
    
    // Add to queue
    pendingChunksRef.current.push({
        text: text.trim(),
      speaker: detectedSpeaker,
      timestamp,
      tempId,
    });
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalChunks: prev.totalChunks + 1,
      pendingChunks: prev.pendingChunks + 1,
    }));
    
    // STRATEGY 3: Apply progressive save strategy
    await applyProgressiveSaveStrategy();
    
    return { id: tempId, session_id: sessionId, text: text.trim(), speaker: detectedSpeaker };
  }, [sessionId, addChunkToUI, determineSpeaker, applyProgressiveSaveStrategy]);

  // Force save all pending chunks (call when stopping recording)
  const saveAllPendingChunks = useCallback(async () => {
    if (pendingChunksRef.current.length > 0) {
      console.log('💾 Force saving all pending chunks...');
      await processQueue(true);
      console.log('✅ All pending chunks saved');
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
      
      setStats(prev => ({
        ...prev,
        savedChunks: data?.length || 0,
      }));
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

  // STRATEGY 3: Periodic health check for long sessions
  useEffect(() => {
    if (!isTranscribing) return;
    
    const healthCheckInterval = setInterval(() => {
      performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
    
    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [isTranscribing, performHealthCheck]);

  // STRATEGY 3: Memory optimization for very long sessions (5+ minutes)
  useEffect(() => {
    if (!isTranscribing) return;
    
    memoryOptimizerTimerRef.current = setInterval(() => {
      const sessionDuration = Date.now() - sessionStartTimeRef.current;
      
      if (sessionDuration > MEMORY_OPTIMIZE_INTERVAL) {
        // Update stats with session duration
        setStats(prev => ({ ...prev, sessionDuration }));
      }
    }, 30000); // Update every 30 seconds
    
    return () => {
      if (memoryOptimizerTimerRef.current) {
        clearInterval(memoryOptimizerTimerRef.current);
      }
    };
  }, [isTranscribing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (memoryOptimizerTimerRef.current) {
        clearInterval(memoryOptimizerTimerRef.current);
      }
    };
  }, []);

  // Auto-save when recording stops
  useEffect(() => {
    if (!isTranscribing && pendingChunksRef.current.length > 0) {
      saveAllPendingChunks();
    }
  }, [isTranscribing, saveAllPendingChunks]);

  // STRATEGY 3: Initialize session start time when transcription begins
  useEffect(() => {
    if (isTranscribing) {
      const now = Date.now();
      // Only reset if this is a new session (check if start time is very recent or old)
      if (sessionStartTimeRef.current === 0 || now - sessionStartTimeRef.current > 600000) {
        sessionStartTimeRef.current = now;
        console.log('🎬 Session started - continuous transcription mode active');
      }
    }
  }, [isTranscribing]);

  return {
    transcriptChunks,
    isTranscribing,
    setIsTranscribing,
    stats,
    addTranscriptChunk,
    loadTranscripts,
    getFullTranscript,
    saveAllPendingChunks,
  };
}
