import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RealTimeTranscription } from '@/utils/RealTimeTranscription';

interface AudioRecordingOptions {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  continuous?: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  interimTranscript: string;
  transcriptSupported: boolean;
  error: string | null;
}

export function useAudioRecording(options: AudioRecordingOptions = {}) {
  const {
    onTranscriptUpdate,
    onFinalTranscriptChunk,
    onRecordingComplete,
    continuous = true,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    isTranscribing: false,
    interimTranscript: '',
    transcriptSupported: true,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<RealTimeTranscription | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      setState(prev => ({ ...prev, error: null }));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      console.log('✅ Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
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
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        
        console.log(`✅ Audio blob created: ${audioBlob.size} bytes`);
        
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
      setState(prev => ({ ...prev, error: errorMessage }));
      toast.error(errorMessage);
    }
  }, [state.transcriptSupported, onRecordingComplete]);

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
    formatDuration,
  };
}
