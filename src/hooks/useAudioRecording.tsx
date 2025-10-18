import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RealTimeTranscription } from '@/utils/RealTimeTranscription';

interface AudioRecordingOptions {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  sampleRate?: number;
  deviceId?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  interimTranscript: string;
  transcriptSupported: boolean;
  error: string | null;
  audioLevel: number;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
}

export function useAudioRecording(options: AudioRecordingOptions = {}) {
  const {
    onTranscriptUpdate,
    onFinalTranscriptChunk,
    onRecordingComplete,
    onError,
    continuous = true,
    sampleRate = 48000,
    deviceId,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    isTranscribing: false,
    interimTranscript: '',
    transcriptSupported: true,
    error: null,
    audioLevel: 0,
    recordedBlob: null,
    recordedUrl: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<RealTimeTranscription | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize transcription engine
  useEffect(() => {
    console.log('🎙️ Initializing real-time transcription engine...');
    
    transcriptionRef.current = new RealTimeTranscription({
      continuous,
      interimResults: true,
      lang: 'en-US',
      onResult: (transcript, isFinal) => {
        console.log('📝 Transcription result:', { 
          text: transcript.substring(0, 50) + '...', 
          isFinal,
          length: transcript.length 
        });
        
        if (isFinal) {
          console.log('✅ Final transcript chunk received');
          if (onFinalTranscriptChunk) {
            onFinalTranscriptChunk(transcript);
          }
          setState(prev => ({ ...prev, interimTranscript: '' }));
        } else {
          console.log('⏳ Interim transcript update');
          setState(prev => ({ ...prev, interimTranscript: transcript }));
        }
        
        if (onTranscriptUpdate) {
          onTranscriptUpdate(transcript, isFinal);
        }
      },
      onError: (error) => {
        console.error('❌ Transcription error:', error);
        setState(prev => ({ ...prev, error }));
        toast.error(error);
      },
      onStart: () => {
        console.log('✅ Transcription started successfully');
        setState(prev => ({ ...prev, isTranscribing: true }));
        toast.success('Real-time transcription active', { duration: 2000 });
      },
      onEnd: () => {
        console.log('🛑 Transcription ended');
        setState(prev => ({ ...prev, isTranscribing: false }));
      },
    });

    const isSupported = transcriptionRef.current.isBrowserSupported();
    setState(prev => ({ ...prev, transcriptSupported: isSupported }));
    
    if (!isSupported) {
      console.warn('⚠️ Real-time transcription not supported in this browser');
    } else {
      console.log('✅ Real-time transcription is supported');
    }

    return () => {
      console.log('🧹 Cleaning up audio recorder...');
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (transcriptionRef.current) {
        transcriptionRef.current.destroy();
      }
    };
  }, [continuous, onFinalTranscriptChunk, onTranscriptUpdate]);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting audio recording...');
      setState(prev => ({ ...prev, error: null, recordedBlob: null, recordedUrl: null }));
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: sampleRate,
          channelCount: 1,
          ...(deviceId && { deviceId: { exact: deviceId } })
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      console.log('✅ Microphone access granted');
      
      // Setup audio level monitoring
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = Math.min(100, (average / 255) * 100);
        
        setState(prev => ({ ...prev, audioLevel: normalized }));
        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };
      
      monitorAudioLevel();
      
      // Try different MIME types for better compatibility
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('✅ Using MIME type:', type);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        
        console.log(`✅ Audio blob created: ${audioBlob.size} bytes (${mimeType})`);
        
        setState(prev => ({ 
          ...prev, 
          recordedBlob: audioBlob,
          recordedUrl: url,
          audioLevel: 0
        }));
        
        // Stop audio monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Audio track stopped');
        });
        
        // Stop transcription
        if (transcriptionRef.current) {
          const finalTranscript = transcriptionRef.current.stop();
          console.log('📝 Final transcript:', finalTranscript);
        }
        
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, url);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
      
      console.log('🎙️ MediaRecorder started');
      
      // Start transcription
      if (transcriptionRef.current && state.transcriptSupported) {
        console.log('🚀 Starting real-time transcription...');
        const started = transcriptionRef.current.start();
        if (!started) {
          console.warn('⚠️ Transcription failed to start');
          toast.warning('Real-time transcription not available. You can still record and transcribe later.');
        }
      } else {
        console.warn('⚠️ Transcription not supported');
        toast.warning('Real-time transcription not supported in this browser. Using Chrome is recommended.');
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('❌ Microphone access error:', error);
      const errorMessage = 'Failed to access microphone. Please grant permission.';
      setState(prev => ({ ...prev, error: errorMessage, audioLevel: 0 }));
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    }
  }, [state.transcriptSupported, onRecordingComplete, onError, sampleRate, deviceId]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      
      // Pause transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.pause();
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info('Recording paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      
      // Resume transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.resume();
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      toast.success('Recording resumed');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isPaused: false,
        duration: 0 
      }));
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success('Recording stopped');
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
    }
    setState(prev => ({
      ...prev,
      recordedBlob: null,
      recordedUrl: null,
      interimTranscript: '',
      duration: 0,
    }));
    chunksRef.current = [];
  }, [state.recordedUrl]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearRecording,
    formatDuration,
  };
}
