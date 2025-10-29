import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface AdvancedRecordingSystemOptions {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onError?: (error: string) => void;
  sessionId?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  isProcessing: boolean;
  error: string | null;
}

export function useAdvancedRecordingSystem(options: AdvancedRecordingSystemOptions = {}) {
  const {
    onTranscriptUpdate,
    onRecordingStateChange,
    onError,
    sessionId,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    isProcessing: false,
    error: null,
  });

  // Refs for maintaining state across renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isStoppingRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up recording system...');
    
    // Stop all timers and animations
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop and cleanup media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.warn('Error stopping media recorder:', error);
      }
    }
    mediaRecorderRef.current = null;

    // Cleanup audio processing
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (error) {
        console.warn('Error disconnecting processor:', error);
      }
      processorRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (error) {
        console.warn('Error disconnecting analyser:', error);
      }
      analyserRef.current = null;
    }

    // Cleanup audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      audioContextRef.current = null;
    }

    // Stop all media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }

    // Clear audio chunks
    chunksRef.current = [];
    isStoppingRef.current = false;
    
    console.log('✅ Cleanup complete');
  }, []);

  // Monitor audio levels
  const startAudioLevelMonitoring = useCallback(() => {
    if (!analyserRef.current) return;
    
    const monitor = () => {
      if (!analyserRef.current || isStoppingRef.current) {
        return;
      }
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalized = Math.min(100, (average / 255) * 100);
      
      setState(prev => ({ ...prev, audioLevel: normalized }));
      animationFrameRef.current = requestAnimationFrame(monitor);
    };
    
    monitor();
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (state.isRecording) {
      console.warn('⚠️ Recording already in progress');
      return;
    }

    try {
      console.log('🎤 Starting advanced recording system...');
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      isStoppingRef.current = false;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      console.log('✅ Microphone access granted');

      // Setup audio context and analyser
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Setup audio processor for real-time transcription
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (isStoppingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Process audio chunks for real-time transcription here
        // You can send this to your transcription service
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // Start audio level monitoring
      startAudioLevelMonitoring();

      // Setup media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isStoppingRef.current) {
          chunksRef.current.push(event.data);
          console.log(`📦 Chunk recorded: ${(event.data.size / 1024).toFixed(2)} KB`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped');
        
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`✅ Final audio: ${(audioBlob.size / 1024).toFixed(2)} KB`);
        
        // You can process the final blob here
        setState(prev => ({ ...prev, isRecording: false, isProcessing: false, duration: 0 }));
        
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        const errorMsg = 'Recording error occurred';
        setState(prev => ({ ...prev, error: errorMsg, isProcessing: false }));
        if (onError) onError(errorMsg);
        toast.error(errorMsg);
        cleanup();
      };

      // Start recording (timeslice of 1000ms for regular chunks)
      mediaRecorder.start(1000);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        isPaused: false,
        isProcessing: false,
        duration: 0,
      }));

      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }

      toast.success('🎙️ Recording started');
      console.log('✅ Recording system fully initialized');

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to access microphone';
      setState(prev => ({ ...prev, error: errorMsg, isProcessing: false }));
      if (onError) onError(errorMsg);
      toast.error(errorMsg);
      cleanup();
    }
  }, [state.isRecording, startAudioLevelMonitoring, cleanup, onRecordingStateChange, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!state.isRecording) {
      console.warn('⚠️ No active recording to stop');
      return;
    }

    console.log('⏹️ Stopping recording...');
    isStoppingRef.current = true;
    setState(prev => ({ ...prev, isProcessing: true }));

    // Stop the media recorder first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Cleanup everything
    cleanup();

    toast.success('Recording stopped');
  }, [state.isRecording, cleanup]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!state.isRecording || state.isPaused) {
      return;
    }

    console.log('⏸️ Pausing recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setState(prev => ({ ...prev, isPaused: true }));
      toast.info('Recording paused');
    }
  }, [state.isRecording, state.isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!state.isRecording || !state.isPaused) {
      return;
    }

    console.log('▶️ Resuming recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      setState(prev => ({ ...prev, isPaused: false }));
      toast.success('Recording resumed');
    }
  }, [state.isRecording, state.isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    audioLevel: state.audioLevel,
    isProcessing: state.isProcessing,
    error: state.error,
    
    // Methods
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
