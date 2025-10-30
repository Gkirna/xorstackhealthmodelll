import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TranscriptionSegment, MedicalEntity, EnhancedTranscriptionData } from '@/types/advancedTranscription';

interface RealtimeTranscriptionState {
  isTranscribing: boolean;
  currentSegments: TranscriptionSegment[];
  currentEntities: MedicalEntity[];
  overallConfidence: number;
  speakerCount: number;
  processingStatus: 'idle' | 'transcribing' | 'analyzing' | 'complete';
  currentText: string;
  interimText: string;
}

interface AudioChunk {
  data: Float32Array;
  timestamp: number;
}

export const useRealtimeAdvancedTranscription = (sessionId: string) => {
  const [state, setState] = useState<RealtimeTranscriptionState>({
    isTranscribing: false,
    currentSegments: [],
    currentEntities: [],
    overallConfidence: 0,
    speakerCount: 0,
    processingStatus: 'idle',
    currentText: '',
    interimText: '',
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<AudioChunk[]>([]);
  const accumulatedAudioRef = useRef<Float32Array>(new Float32Array(0));
  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Real-time processing configuration
  const SAMPLE_RATE = 24000;
  const CHUNK_DURATION_MS = 3000; // Process every 3 seconds for real-time feel
  const MIN_AUDIO_LENGTH = SAMPLE_RATE * 2; // Minimum 2 seconds of audio
  const MAX_BUFFER_SIZE = SAMPLE_RATE * 30; // Maximum 30 seconds buffered

  // Convert Float32Array to base64
  const encodeAudioToBase64 = useCallback((audioData: Float32Array): string => {
    const int16Array = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }, []);

  // Process accumulated audio chunks
  const processAudioChunks = useCallback(async () => {
    if (isProcessingRef.current || accumulatedAudioRef.current.length < MIN_AUDIO_LENGTH) {
      return;
    }

    isProcessingRef.current = true;
    setState(prev => ({ ...prev, processingStatus: 'transcribing' }));

    try {
      const audioData = accumulatedAudioRef.current;
      const base64Audio = encodeAudioToBase64(audioData);

      console.log(`🎙️ Processing ${(audioData.length / SAMPLE_RATE).toFixed(1)}s of audio...`);

      // Step 1: Advanced transcription with speaker diarization
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('advanced-transcribe', {
        body: { audio: base64Audio, session_id: sessionId }
      });

      if (transcriptionError || !transcriptionData?.success) {
        throw new Error(transcriptionError?.message || 'Transcription failed');
      }

      const segments = transcriptionData.segments || [];
      const fullText = transcriptionData.text || '';
      const confidence = transcriptionData.confidence || 0;
      const speakerCount = transcriptionData.speaker_count || 0;

      console.log(`✅ Transcribed: ${segments.length} segments, ${speakerCount} speakers`);

      setState(prev => ({
        ...prev,
        currentSegments: [...prev.currentSegments, ...segments],
        currentText: prev.currentText ? `${prev.currentText}\n${fullText}` : fullText,
        overallConfidence: confidence,
        speakerCount,
        processingStatus: 'analyzing',
      }));

      // Step 2: Extract medical entities (non-blocking)
      if (fullText.length > 10) {
        setState(prev => ({ ...prev, processingStatus: 'analyzing' }));
        
        const { data: entityData, error: entityError } = await supabase.functions.invoke('extract-medical-entities', {
          body: { text: fullText, segments }
        });

        if (!entityError && entityData?.success) {
          const entities = entityData.entities || [];
          console.log(`🏥 Extracted ${entities.length} medical entities`);

          setState(prev => ({
            ...prev,
            currentEntities: [...prev.currentEntities, ...entities],
            processingStatus: 'complete',
          }));
        }
      }

      // Clear processed audio (keep last 5 seconds for context)
      const keepSamples = SAMPLE_RATE * 5;
      if (accumulatedAudioRef.current.length > keepSamples) {
        accumulatedAudioRef.current = accumulatedAudioRef.current.slice(-keepSamples);
      }

    } catch (error) {
      console.error('❌ Real-time processing error:', error);
      setState(prev => ({ ...prev, processingStatus: 'idle' }));
    } finally {
      isProcessingRef.current = false;
    }
  }, [encodeAudioToBase64, sessionId]);

  // Start real-time transcription
  const startTranscription = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioChunk = new Float32Array(inputData);

        // Accumulate audio data
        const newBuffer = new Float32Array(accumulatedAudioRef.current.length + audioChunk.length);
        newBuffer.set(accumulatedAudioRef.current, 0);
        newBuffer.set(audioChunk, accumulatedAudioRef.current.length);
        accumulatedAudioRef.current = newBuffer;

        // Limit buffer size
        if (accumulatedAudioRef.current.length > MAX_BUFFER_SIZE) {
          accumulatedAudioRef.current = accumulatedAudioRef.current.slice(-MAX_BUFFER_SIZE);
        }

        audioChunksRef.current.push({
          data: audioChunk,
          timestamp: Date.now(),
        });
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setState(prev => ({ ...prev, isTranscribing: true, processingStatus: 'transcribing' }));

      // Start periodic processing
      processingTimerRef.current = setInterval(() => {
        processAudioChunks();
      }, CHUNK_DURATION_MS);

      console.log('🎙️ Real-time advanced transcription started');
      toast.success('Advanced real-time transcription started');

    } catch (error) {
      console.error('Failed to start transcription:', error);
      toast.error('Microphone access denied');
      throw error;
    }
  }, [processAudioChunks]);

  // Stop transcription
  const stopTranscription = useCallback(async () => {
    // Stop periodic processing
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }

    // Process any remaining audio
    if (accumulatedAudioRef.current.length >= MIN_AUDIO_LENGTH) {
      await processAudioChunks();
    }

    // Clean up audio resources
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isTranscribing: false,
      processingStatus: 'complete',
      interimText: '',
    }));

    console.log('🛑 Real-time transcription stopped');
    toast.success('Transcription completed');
  }, [processAudioChunks]);

  // Get complete enhanced data
  const getEnhancedData = useCallback((): EnhancedTranscriptionData => {
    const entityStats = state.currentEntities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = state.currentEntities.length > 0
      ? state.currentEntities.reduce((sum, e) => sum + e.confidence, 0) / state.currentEntities.length
      : 0;

    return {
      transcript: state.currentText,
      segments: state.currentSegments,
      entities: state.currentEntities,
      confidence: state.overallConfidence,
      speaker_count: state.speakerCount,
      statistics: {
        total_entities: state.currentEntities.length,
        by_type: entityStats,
        avg_confidence: avgConfidence,
      },
    };
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isTranscribing) {
        stopTranscription();
      }
    };
  }, [state.isTranscribing, stopTranscription]);

  return {
    ...state,
    startTranscription,
    stopTranscription,
    getEnhancedData,
  };
};
