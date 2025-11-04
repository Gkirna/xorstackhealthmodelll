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
  const currentVoiceCharacteristicsRef = useRef<any>(null);
  const genderHistoryRef = useRef<{ gender: 'male' | 'female', timestamp: number }[]>([]);
  const lastSpeakerPitchRef = useRef<number>(0);
  const recentChunksRef = useRef<{ length: number, speaker: string }[]>([]);
  
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
  
  // ADAPTIVE SPEAKER DETECTION CONFIGURATION
  const ADAPTIVE_CONFIG = {
    confidence: {
      high: { threshold: 0.90, minDuration: 800, minChunks: 1 },      // Very confident - allow quick changes
      medium: { threshold: 0.75, minDuration: 1500, minChunks: 1 },   // Moderately confident - slightly longer
      low: { minDuration: 5000, minChunks: 2 }                        // Low confidence - safe fallback
    },
    pitchDifference: {
      high: { threshold: 40, multiplier: 0.7 },      // Large pitch diff - reduce threshold by 30%
      medium: { threshold: 20, multiplier: 0.85 }    // Medium pitch diff - reduce by 15%
    },
    conversationType: {
      rapidFire: { chunkLength: 30, changeRate: 0.6, multiplier: 0.6 },    // Short chunks + frequent changes
      narrative: { chunkLength: 100, changeRate: 0.2, multiplier: 1.3 }    // Long chunks + rare changes
    },
    voiceQuality: {
      poor: { multiplier: 1.5 }  // Poor quality - increase threshold by 50%
    },
    bounds: { min: 500, max: 8000 }  // Safety bounds: 0.5s to 8s
  };
  
  // STRATEGY 2: Enhanced Smart Speaker Detection (Legacy - used as fallback)
  const GAP_THRESHOLD_MS = 30000; // 30 seconds - gaps less than this don't trigger speaker change
  const SHORT_PAUSE_MS = 3000; // 3 seconds - short natural pause
  const MEDIUM_PAUSE_MS = 10000; // 10 seconds - medium pause (thinking/clinical activity)
  const LONG_PAUSE_MS = 30000; // 30 seconds - long pause (guaranteed speaker change)

  // Real-time subscription for instant updates
  useTranscriptUpdates(sessionId, (newTranscript) => {
    console.log('📡 Real-time update received:', newTranscript);
    
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

  // Detect conversation type based on recent chunks
  const detectConversationType = useCallback((): 'rapid-fire' | 'narrative' | 'clinical' => {
    const recentChunks = recentChunksRef.current.slice(-10); // Last 10 chunks
    
    if (recentChunks.length < 5) return 'clinical'; // Default for new sessions
    
    const avgChunkLength = recentChunks.reduce((sum, c) => sum + c.length, 0) / recentChunks.length;
    
    // Count speaker changes
    let changes = 0;
    for (let i = 1; i < recentChunks.length; i++) {
      if (recentChunks[i].speaker !== recentChunks[i - 1].speaker) changes++;
    }
    const changeRate = changes / (recentChunks.length - 1);
    
    // Rapid-fire: short chunks + frequent changes
    if (avgChunkLength < ADAPTIVE_CONFIG.conversationType.rapidFire.chunkLength && 
        changeRate > ADAPTIVE_CONFIG.conversationType.rapidFire.changeRate) {
      console.log(`🔥 Rapid-fire conversation detected (avg: ${avgChunkLength.toFixed(0)} chars, ${(changeRate * 100).toFixed(0)}% changes)`);
      return 'rapid-fire';
    }
    
    // Narrative: long chunks + rare changes
    if (avgChunkLength > ADAPTIVE_CONFIG.conversationType.narrative.chunkLength && 
        changeRate < ADAPTIVE_CONFIG.conversationType.narrative.changeRate) {
      console.log(`📖 Narrative conversation detected (avg: ${avgChunkLength.toFixed(0)} chars, ${(changeRate * 100).toFixed(0)}% changes)`);
      return 'narrative';
    }
    
    console.log(`🏥 Clinical conversation (avg: ${avgChunkLength.toFixed(0)} chars, ${(changeRate * 100).toFixed(0)}% changes)`);
    return 'clinical'; // Default middle ground
  }, []);

  // Calculate adaptive speaker thresholds based on multiple factors
  const calculateAdaptiveSpeakerThresholds = useCallback((
    voiceConfidence: number,
    pitchDifference: number,
    voiceQuality: 'excellent' | 'good' | 'fair' | 'poor'
  ): { minDuration: number, minChunks: number } => {
    
    // STEP 1: Base threshold from confidence level
    let minDuration: number;
    let minChunks: number;
    
    if (voiceConfidence >= ADAPTIVE_CONFIG.confidence.high.threshold) {
      minDuration = ADAPTIVE_CONFIG.confidence.high.minDuration;
      minChunks = ADAPTIVE_CONFIG.confidence.high.minChunks;
      console.log(`🟢 HIGH confidence (${(voiceConfidence * 100).toFixed(0)}%) - Base: ${minDuration}ms`);
    } else if (voiceConfidence >= ADAPTIVE_CONFIG.confidence.medium.threshold) {
      minDuration = ADAPTIVE_CONFIG.confidence.medium.minDuration;
      minChunks = ADAPTIVE_CONFIG.confidence.medium.minChunks;
      console.log(`🟡 MEDIUM confidence (${(voiceConfidence * 100).toFixed(0)}%) - Base: ${minDuration}ms`);
    } else {
      minDuration = ADAPTIVE_CONFIG.confidence.low.minDuration;
      minChunks = ADAPTIVE_CONFIG.confidence.low.minChunks;
      console.log(`🔴 LOW confidence (${(voiceConfidence * 100).toFixed(0)}%) - Base: ${minDuration}ms`);
    }
    
    // STEP 2: Apply pitch difference multiplier
    if (pitchDifference >= ADAPTIVE_CONFIG.pitchDifference.high.threshold) {
      minDuration *= ADAPTIVE_CONFIG.pitchDifference.high.multiplier;
      console.log(`🎵 Large pitch diff (${pitchDifference.toFixed(0)}Hz) - Reduced to: ${minDuration.toFixed(0)}ms`);
    } else if (pitchDifference >= ADAPTIVE_CONFIG.pitchDifference.medium.threshold) {
      minDuration *= ADAPTIVE_CONFIG.pitchDifference.medium.multiplier;
      console.log(`🎵 Medium pitch diff (${pitchDifference.toFixed(0)}Hz) - Reduced to: ${minDuration.toFixed(0)}ms`);
    }
    
    // STEP 3: Apply conversation type multiplier
    const conversationType = detectConversationType();
    if (conversationType === 'rapid-fire') {
      minDuration *= ADAPTIVE_CONFIG.conversationType.rapidFire.multiplier;
      console.log(`⚡ Rapid-fire mode - Reduced to: ${minDuration.toFixed(0)}ms`);
    } else if (conversationType === 'narrative') {
      minDuration *= ADAPTIVE_CONFIG.conversationType.narrative.multiplier;
      console.log(`📚 Narrative mode - Increased to: ${minDuration.toFixed(0)}ms`);
    }
    
    // STEP 4: Apply voice quality adjustment
    if (voiceQuality === 'poor' || voiceQuality === 'fair') {
      minDuration *= ADAPTIVE_CONFIG.voiceQuality.poor.multiplier;
      console.log(`🔊 Poor voice quality - Increased to: ${minDuration.toFixed(0)}ms`);
    }
    
    // STEP 5: Apply safety bounds
    minDuration = Math.max(ADAPTIVE_CONFIG.bounds.min, Math.min(ADAPTIVE_CONFIG.bounds.max, minDuration));
    console.log(`✅ Final adaptive threshold: ${minDuration.toFixed(0)}ms, ${minChunks} chunks`);
    
    return { minDuration, minChunks };
  }, [detectConversationType]);

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

  // ADVANCED: Voice-based speaker detection using pitch/frequency characteristics
  // This is the PRIMARY method - uses advanced voice analysis from VoiceAnalyzer
  const detectSpeakerByGender = useCallback((text: string): string | null => {
    console.log('🔍 detectSpeakerByGender called');
    
    if (!currentVoiceGenderRef.current || currentVoiceGenderRef.current === 'unknown') {
      console.log('⚠️ Voice gender unknown, returning null');
      return null;
    }
    
    // Get current voice characteristics from analyzer
    const characteristics = currentVoiceCharacteristicsRef.current;
    console.log('🎤 Current characteristics:', characteristics);
    
    if (!characteristics || characteristics.confidence < 0.7) {
      console.log('⚠️ Low confidence voice characteristics, using fallback');
      return null;
    }
    
    // Use speakerId from VoiceAnalyzer (already handles pitch/frequency differentiation)
    const speakerId = characteristics.speakerId;
    
    // Silence detection
    if (speakerId === 'silence') {
      console.log('🔇 Silence detected, returning null');
      return null;
    }
    
    // Map speaker IDs to provider/patient
    // First detected speaker = provider, different voice = patient
    if (speakerId.includes('speaker_1')) {
      console.log(`🎭 Speaker 1 detected (${characteristics.pitch.toFixed(0)}Hz) → Provider`);
      return 'provider';
    } else {
      console.log(`🎭 Speaker 2+ detected (${characteristics.pitch.toFixed(0)}Hz) → Patient`);
      return 'patient';
    }
  }, []);

  // FALLBACK: Gap-based speaker detection (ONLY when voice analysis unavailable)
  // This is UNRELIABLE for same speaker with long pauses - use voice analysis instead!
  const determineSpeakerByGaps = useCallback((text: string): string => {
    console.warn('⚠️ Using GAP-BASED detection (unreliable for same speaker with pauses)');
    console.warn('💡 Ensure VoiceAnalyzer is properly initialized for better accuracy');
    
    const now = Date.now();
    const timeSinceLastChunk = now - lastChunkTimeRef.current;
    const timeSinceLastChange = now - lastSpeakerChangeTimeRef.current;
    
    // Update last chunk time
    lastChunkTimeRef.current = now;
    
    // Constants - INCREASED to 60 seconds to reduce false speaker changes
    const SHORT_PAUSE = 3000;    // 3 seconds
    const MEDIUM_PAUSE = 10000;  // 10 seconds  
    const LONG_PAUSE = 60000;    // 60 seconds (increased from 30)
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

  // ADAPTIVE PRIORITY SYSTEM: Voice-based detection with adaptive thresholds
  const determineSpeaker = useCallback((text: string): string => {
    const now = Date.now();
    const timeSinceLastChange = now - lastSpeakerChangeTimeRef.current;
    
    // Track recent chunks for conversation type detection
    recentChunksRef.current.push({ length: text.length, speaker: lastSpeakerRef.current });
    if (recentChunksRef.current.length > 10) {
      recentChunksRef.current.shift(); // Keep only last 10
    }
    
    // PRIORITY 1: Voice analysis with adaptive thresholds
    const voiceSpeaker = detectSpeakerByGender(text);
    const characteristics = currentVoiceCharacteristicsRef.current;
    
    if (voiceSpeaker && characteristics) {
      const voiceConfidence = characteristics.confidence || 0;
      const currentPitch = characteristics.pitch || 0;
      const voiceQuality = characteristics.voiceQuality || 'fair';
      
      // Calculate pitch difference from last speaker
      const pitchDifference = lastSpeakerPitchRef.current > 0 
        ? Math.abs(currentPitch - lastSpeakerPitchRef.current) 
        : 0;
      
      // Get adaptive thresholds
      const { minDuration, minChunks } = calculateAdaptiveSpeakerThresholds(
        voiceConfidence,
        pitchDifference,
        voiceQuality
      );
      
      // Check if speaker change is allowed based on adaptive thresholds
      const shouldAllowChange = voiceSpeaker !== lastSpeakerRef.current && (
        timeSinceLastChange >= minDuration && 
        chunkCountPerSpeakerRef.current >= minChunks
      );
      
      if (shouldAllowChange || voiceSpeaker === lastSpeakerRef.current) {
        if (voiceSpeaker !== lastSpeakerRef.current) {
          console.log(`🔄 ADAPTIVE speaker change: ${lastSpeakerRef.current} → ${voiceSpeaker} (threshold: ${minDuration}ms, chunks: ${minChunks})`);
          lastSpeakerChangeTimeRef.current = now;
          chunkCountPerSpeakerRef.current = 0;
        } else {
          chunkCountPerSpeakerRef.current++;
        }
        
        lastSpeakerRef.current = voiceSpeaker;
        lastSpeakerPitchRef.current = currentPitch;
        lastChunkTimeRef.current = now;
        
        console.log(`✅ Voice-based (adaptive): ${voiceSpeaker} | Confidence: ${(voiceConfidence * 100).toFixed(0)}% | Pitch: ${currentPitch.toFixed(0)}Hz | Quality: ${voiceQuality}`);
        return voiceSpeaker;
      } else {
        console.log(`⏸️ Speaker change blocked by adaptive threshold (need ${minDuration}ms, have ${timeSinceLastChange}ms)`);
        chunkCountPerSpeakerRef.current++;
        lastChunkTimeRef.current = now;
        return lastSpeakerRef.current;
      }
    }
    
    // PRIORITY 2: Gap detection fallback (only when voice analysis unavailable)
    console.warn('⚠️ Voice analysis unavailable - using gap detection fallback');
    return determineSpeakerByGaps(text);
  }, [detectSpeakerByGender, determineSpeakerByGaps, calculateAdaptiveSpeakerThresholds]);

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
        return `${speakerLabel} : ${chunk.text}`;
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

  // Method to update voice characteristics from external source
  const updateVoiceCharacteristics = useCallback((characteristics: any) => {
    currentVoiceCharacteristicsRef.current = characteristics;
    console.log('🎤 Voice characteristics updated in transcription:', characteristics);
  }, []);

  return {
    transcriptChunks,
    isTranscribing,
    setIsTranscribing,
    stats,
    addTranscriptChunk,
    loadTranscripts,
    getFullTranscript,
    saveAllPendingChunks,
    updateVoiceCharacteristics,
  };
}
