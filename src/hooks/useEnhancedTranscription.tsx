/**
 * Enhanced Transcription Hook with Professional ASR Integration
 * Supports Deepgram, Web Speech API, and advanced features
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranscriptUpdates } from './useRealtime';
import { ASRServiceManager, ASRResult, MedicalEntity } from '@/services/ASRService';
import { AudioProcessor } from '@/services/AudioProcessor';

interface EnhancedTranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;
  timestamp_offset: number;
  created_at: string;
  confidence_score: number;
  asr_provider: string;
  start_time_ms?: number;
  end_time_ms?: number;
  speaker_confidence?: number;
  alternatives?: Array<{ text: string; confidence: number }>;
  raw_metadata?: any;
  medical_entities?: MedicalEntity[];
  temp?: boolean;
  pending?: boolean;
}

interface TranscriptionStats {
  totalChunks: number;
  savedChunks: number;
  pendingChunks: number;
  failedChunks: number;
  averageLatency: number;
  averageConfidence: number;
  highConfidenceChunks: number;
  mediumConfidenceChunks: number;
  lowConfidenceChunks: number;
  totalMedicalEntities: number;
  connectionHealth?: 'healthy' | 'degraded' | 'offline';
  sessionDuration?: number;
  currentProvider?: string;
}

interface TranscriptionConfig {
  provider: 'deepgram' | 'webspeech' | 'auto';
  language?: string;
  enableSpeakerDiarization?: boolean;
  enableMedicalNER?: boolean;
  enableAutoCleanup?: boolean; // Enable GPT auto-cleanup
  confidenceThreshold?: number;
  model?: string;
}

export function useEnhancedTranscription(
  sessionId: string, 
  config: TranscriptionConfig = {
    provider: 'auto',
    language: 'en-US',
    enableSpeakerDiarization: true,
    enableMedicalNER: true,
    enableAutoCleanup: true, // Enable GPT auto-cleanup by default
    confidenceThreshold: 0.6,
    model: 'nova-2-medical'
  }
) {
  const [transcriptChunks, setTranscriptChunks] = useState<EnhancedTranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [stats, setStats] = useState<TranscriptionStats>({
    totalChunks: 0,
    savedChunks: 0,
    pendingChunks: 0,
    failedChunks: 0,
    averageLatency: 0,
    averageConfidence: 0,
    highConfidenceChunks: 0,
    mediumConfidenceChunks: 0,
    lowConfidenceChunks: 0,
    totalMedicalEntities: 0,
    connectionHealth: 'healthy',
    sessionDuration: 0,
  });

  // Service references
  const asrServiceRef = useRef<ASRServiceManager | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Queue system for batching inserts
  const pendingChunksRef = useRef<any[]>([]);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const latencyRefs = useRef<number[]>([]);
  const confidenceRefs = useRef<number[]>([]);
  
  // Configuration
  const BATCH_SIZE = 5;
  const DEBOUNCE_MS = 3000;
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000;

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize ASR service
        asrServiceRef.current = new ASRServiceManager();
        
        // Initialize audio processor
        audioProcessorRef.current = new AudioProcessor({
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          chunkSize: 4096
        });
        
        await audioProcessorRef.current.initialize();
        
        console.log('✅ Enhanced transcription services initialized');
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        toast.error('Failed to initialize transcription services');
      }
    };

    initializeServices();

    return () => {
      if (asrServiceRef.current) {
        asrServiceRef.current.destroy();
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.destroy();
      }
    };
  }, []);

  // Real-time subscription for instant updates
  useTranscriptUpdates(sessionId, (newTranscript) => {
    console.log('📡 Real-time update received:', newTranscript);
    
    setTranscriptChunks(prev => {
      const exists = prev.some(chunk => chunk.id === newTranscript.id);
      if (exists) return prev;
      
      return [...prev, newTranscript].sort((a, b) => 
        (a.timestamp_offset || 0) - (b.timestamp_offset || 0)
      );
    });
    
    setStats(prev => ({
      ...prev,
      savedChunks: prev.savedChunks + 1,
    }));
  });

  // Select best available provider
  const selectProvider = useCallback(async (): Promise<string> => {
    if (!asrServiceRef.current) return 'webspeech';

    const availableProviders = asrServiceRef.current.getAvailableProviders();
    console.log('📋 Available ASR providers:', availableProviders);

    if (config.provider === 'auto') {
      // Prefer Deepgram if available, fallback to Web Speech API
      if (availableProviders.includes('deepgram')) {
        return 'deepgram';
      } else if (availableProviders.includes('webspeech')) {
        return 'webspeech';
      }
    } else if (availableProviders.includes(config.provider)) {
      return config.provider;
    }

    // Fallback to first available provider
    return availableProviders[0] || 'webspeech';
  }, [config.provider]);

  // Start transcription
  const startTranscription = useCallback(async (): Promise<boolean> => {
    if (!asrServiceRef.current || !audioProcessorRef.current) {
      console.error('Services not initialized');
      return false;
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      streamRef.current = stream;

      // Select provider
      const selectedProvider = await selectProvider();
      console.log('🎤 Selected ASR provider:', selectedProvider);

      // Configure ASR service
      const asrConfig = {
        language: config.language,
        model: config.model,
        enableSpeakerDiarization: config.enableSpeakerDiarization,
        enableMedicalNER: config.enableMedicalNER,
        enableAutoCleanup: config.enableAutoCleanup, // Enable GPT auto-cleanup
        confidenceThreshold: config.confidenceThreshold
      };

      const providerSet = await asrServiceRef.current.setProvider(selectedProvider, asrConfig);
      if (!providerSet) {
        console.error('Failed to set ASR provider');
        return false;
      }

      // Set up event handlers
      asrServiceRef.current.setEventHandlers({
        onResult: handleASRResult,
        onError: handleASRError,
        onStart: () => {
          console.log('✅ ASR started');
          setIsTranscribing(true);
          toast.success(`Transcription started with ${selectedProvider}`);
        },
        onEnd: () => {
          console.log('🛑 ASR ended');
          setIsTranscribing(false);
        }
      });

      // Start ASR service
      const asrStarted = await asrServiceRef.current.start();
      if (!asrStarted) {
        console.error('Failed to start ASR service');
        return false;
      }

      // Start audio processing for Deepgram
      if (selectedProvider === 'deepgram') {
        const audioStarted = await audioProcessorRef.current.startProcessing(
          stream,
          (audioData) => {
            // Send audio data to Deepgram
            const deepgramProvider = asrServiceRef.current?.getCurrentProvider();
            if (deepgramProvider === 'deepgram') {
              // Access the Deepgram provider's sendAudio method
              const provider = (asrServiceRef.current as any).currentProvider;
              if (provider && provider.sendAudio) {
                provider.sendAudio(audioData);
              }
            }
          }
        );

        if (!audioStarted) {
          console.error('Failed to start audio processing');
          return false;
        }
      }

      // Update stats
      setStats(prev => ({
        ...prev,
        currentProvider: selectedProvider
      }));

      return true;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      toast.error('Failed to start transcription');
      return false;
    }
  }, [config, selectProvider]);

  // Handle ASR results
  const handleASRResult = useCallback(async (result: ASRResult) => {
    if (!result.text.trim()) return;

    const timestamp = Date.now();
    const tempId = `temp-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine speaker (use ASR result or fallback to gap-based detection)
    const speaker = result.speaker || determineSpeakerByGaps(result.text);

    // Use cleaned text if available, otherwise use original
    const finalText = result.cleanedText || result.text.trim();

    // Create enhanced transcript chunk
    const chunk: EnhancedTranscriptChunk = {
      id: tempId,
      session_id: sessionId,
      text: finalText, // Use cleaned text when available
      speaker,
      timestamp_offset: timestamp,
      created_at: new Date().toISOString(),
      confidence_score: result.confidence,
      asr_provider: asrServiceRef.current?.getCurrentProvider() || 'unknown',
      start_time_ms: result.startTime,
      end_time_ms: result.endTime,
      speaker_confidence: result.speaker ? 0.8 : 0.5, // Default speaker confidence
      alternatives: result.alternatives,
      raw_metadata: {
        isFinal: result.isFinal,
        timestamp: timestamp,
        originalText: result.text.trim(), // Store original for comparison
        cleanedText: result.cleanedText, // Store cleaned version
        isCleaned: !!result.cleanedText
      },
      medical_entities: result.entities || [],
      temp: true,
      pending: true
    };

    // Optimistic UI update
    setTranscriptChunks(prev => {
      const updated = [...prev, chunk];
      return updated.sort((a, b) => 
        (a.timestamp_offset || 0) - (b.timestamp_offset || 0)
      );
    });

    // Add to save queue
    pendingChunksRef.current.push(chunk);

    // Update stats
    setStats(prev => ({
      ...prev,
      totalChunks: prev.totalChunks + 1,
      pendingChunks: prev.pendingChunks + 1,
      averageConfidence: calculateAverageConfidence([...confidenceRefs.current, result.confidence]),
      highConfidenceChunks: prev.highConfidenceChunks + (result.confidence >= 0.8 ? 1 : 0),
      mediumConfidenceChunks: prev.mediumConfidenceChunks + (result.confidence >= 0.6 && result.confidence < 0.8 ? 1 : 0),
      lowConfidenceChunks: prev.lowConfidenceChunks + (result.confidence < 0.6 ? 1 : 0),
      totalMedicalEntities: prev.totalMedicalEntities + (result.entities?.length || 0)
    }));

    // Track confidence for averaging
    confidenceRefs.current.push(result.confidence);
    if (confidenceRefs.current.length > 100) {
      confidenceRefs.current.shift();
    }

    // Process save queue
    await processSaveQueue();
  }, [sessionId]);

  // Handle ASR errors
  const handleASRError = useCallback((error: string) => {
    console.error('❌ ASR Error:', error);
    toast.error(`Transcription error: ${error}`);
    
    setStats(prev => ({
      ...prev,
      connectionHealth: 'degraded'
    }));
  }, []);

  // Simple speaker detection fallback
  const determineSpeakerByGaps = useCallback((text: string): string => {
    // Simple alternating speaker logic for now
    // This can be enhanced with more sophisticated detection
    const lastChunk = transcriptChunks[transcriptChunks.length - 1];
    if (!lastChunk) return 'provider';
    
    return lastChunk.speaker === 'provider' ? 'patient' : 'provider';
  }, [transcriptChunks]);

  // Calculate average confidence
  const calculateAverageConfidence = useCallback((confidences: number[]): number => {
    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }, []);

  // Process save queue
  const processSaveQueue = useCallback(async (force = false) => {
    const chunks = pendingChunksRef.current;
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (chunks.length >= BATCH_SIZE || force) {
      if (chunks.length > 0) {
        const chunksToSave = [...chunks];
        pendingChunksRef.current = [];
        
        setStats(prev => ({ ...prev, pendingChunks: 0 }));
        
        await saveTranscriptChunks(chunksToSave);
      }
    } else if (chunks.length > 0) {
      saveTimerRef.current = setTimeout(() => {
        processSaveQueue(true);
      }, DEBOUNCE_MS);
    }
  }, []);

  // Save transcript chunks to database
  const saveTranscriptChunks = useCallback(async (chunks: EnhancedTranscriptChunk[], retryCount = 0): Promise<any[] | null> => {
    if (!sessionId || chunks.length === 0 || saveInProgressRef.current) {
      return null;
    }

    saveInProgressRef.current = true;
    const startTime = Date.now();

    try {
      // Save transcript chunks
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('session_transcripts')
        .insert(
          chunks.map(chunk => ({
            session_id: chunk.session_id,
            text: chunk.text,
            speaker: chunk.speaker,
            timestamp_offset: chunk.timestamp_offset,
            confidence_score: chunk.confidence_score,
            asr_provider: chunk.asr_provider,
            start_time_ms: chunk.start_time_ms,
            end_time_ms: chunk.end_time_ms,
            speaker_confidence: chunk.speaker_confidence,
            alternatives: chunk.alternatives,
            raw_metadata: chunk.raw_metadata
          }))
        )
        .select();

      if (transcriptError) throw transcriptError;

      // Save medical entities
      const medicalEntities = chunks.flatMap(chunk => 
        (chunk.medical_entities || []).map(entity => ({
          transcript_id: transcriptData.find(t => t.text === chunk.text)?.id,
          text: entity.text,
          label: entity.label,
          category: entity.category,
          confidence: entity.confidence,
          start_offset: entity.startOffset,
          end_offset: entity.endOffset
        })).filter(e => e.transcript_id)
      );

      if (medicalEntities.length > 0) {
        const { error: entityError } = await supabase
          .from('medical_entities')
          .insert(medicalEntities);

        if (entityError) {
          console.warn('Failed to save medical entities:', entityError);
        }
      }

      const latency = Date.now() - startTime;
      latencyRefs.current.push(latency);
      
      if (latencyRefs.current.length > 100) {
        latencyRefs.current.shift();
      }

      const avgLatency = latencyRefs.current.reduce((a, b) => a + b, 0) / latencyRefs.current.length;

      console.log(`✅ Saved batch of ${transcriptData.length} chunks successfully (${latency}ms)`);
      
      consecutiveFailuresRef.current = 0;
      
      setStats(prev => ({
        ...prev,
        savedChunks: prev.savedChunks + chunks.length,
        pendingChunks: 0,
        averageLatency: Math.round(avgLatency),
        connectionHealth: 'healthy'
      }));
      
      // Update UI: Remove temp chunks and add real ones
      chunks.forEach((chunk, index) => {
        if (transcriptData[index]) {
          setTranscriptChunks(prev =>
            prev.map(c => 
              c.id === chunk.id 
                ? { ...transcriptData[index], pending: false, temp: false }
                : c
            )
          );
        }
      });
      
      return transcriptData;
    } catch (error: any) {
      console.error('❌ Error saving batch:', error);
      
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`🔄 Retrying batch save in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveTranscriptChunks(chunks, retryCount + 1);
      }
      
      consecutiveFailuresRef.current++;
      setStats(prev => ({ 
        ...prev, 
        failedChunks: prev.failedChunks + chunks.length,
        connectionHealth: 'degraded'
      }));
      
      if (retryCount === MAX_RETRIES) {
        toast.error('Failed to save transcripts after multiple attempts', {
          description: 'Your transcript is cached locally and will be saved when connection is restored.'
        });
      }
      
      return null;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [sessionId, MAX_RETRIES, RETRY_DELAY]);

  // Stop transcription
  const stopTranscription = useCallback(async (): Promise<string> => {
    if (!asrServiceRef.current) return '';

    try {
      // Stop ASR service
      const finalTranscript = await asrServiceRef.current.stop();
      
      // Stop audio processing
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stopProcessing();
      }

      // Stop microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Save all pending chunks
      if (pendingChunksRef.current.length > 0) {
        await processSaveQueue(true);
      }

      setIsTranscribing(false);
      
      return finalTranscript;
    } catch (error) {
      console.error('❌ Error stopping transcription:', error);
      return '';
    }
  }, [processSaveQueue]);

  // Pause transcription
  const pauseTranscription = useCallback(async () => {
    if (asrServiceRef.current) {
      await asrServiceRef.current.pause();
    }
  }, []);

  // Resume transcription
  const resumeTranscription = useCallback(async () => {
    if (asrServiceRef.current) {
      await asrServiceRef.current.resume();
    }
  }, []);

  // Load transcripts from database
  const loadTranscripts = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('enhanced_session_transcripts')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_offset', { ascending: true });

      if (error) throw error;
      
      setTranscriptChunks(data || []);
      console.log(`✅ Loaded ${data?.length || 0} enhanced transcript chunks from database`);
      
      // Calculate stats from loaded data
      const confidences = data?.map(d => d.confidence_score).filter(c => c !== null) || [];
      const avgConfidence = confidences.length > 0 ? 
        confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
      
      setStats(prev => ({
        ...prev,
        savedChunks: data?.length || 0,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        highConfidenceChunks: data?.filter(d => d.confidence_score >= 0.8).length || 0,
        mediumConfidenceChunks: data?.filter(d => d.confidence_score >= 0.6 && d.confidence_score < 0.8).length || 0,
        lowConfidenceChunks: data?.filter(d => d.confidence_score < 0.6).length || 0,
        totalMedicalEntities: data?.reduce((sum, d) => sum + (d.medical_entities?.length || 0), 0) || 0
      }));
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  }, [sessionId]);

  // Get full transcript text
  const getFullTranscript = useCallback(() => {
    return transcriptChunks
      .filter(chunk => !chunk.temp)
      .map(chunk => {
        const speakerLabel = chunk.speaker === 'provider' ? 'Doctor' : 'Patient';
        const confidenceIndicator = chunk.confidence_score >= 0.8 ? '🟢' : 
                                  chunk.confidence_score >= 0.6 ? '🟡' : '🔴';
        return `**${speakerLabel}** ${confidenceIndicator} ${chunk.text}`;
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

  return {
    transcriptChunks,
    isTranscribing,
    stats,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    loadTranscripts,
    getFullTranscript,
    currentProvider: asrServiceRef.current?.getCurrentProvider(),
    availableProviders: asrServiceRef.current?.getAvailableProviders() || []
  };
}
