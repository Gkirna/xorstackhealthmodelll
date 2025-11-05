import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface StreamingOptions {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  sessionId: string | null;
}

export function useAssemblyAIStreaming(options: StreamingOptions = {}) {
  const {
    onPartialTranscript,
    onFinalTranscript,
    onError,
    enabled = false,
  } = options;

  const [state, setState] = useState<StreamingState>({
    isConnected: false,
    isStreaming: false,
    isPaused: false,
    error: null,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const hasConnectedRef = useRef(false);
  
  // Use refs for callbacks to avoid reconnections
  const onPartialTranscriptRef = useRef(onPartialTranscript);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  
  // Update callback refs when callbacks change
  useEffect(() => {
    onPartialTranscriptRef.current = onPartialTranscript;
    onFinalTranscriptRef.current = onFinalTranscript;
    onErrorRef.current = onError;
  }, [onPartialTranscript, onFinalTranscript, onError]);

  // Connect to AssemblyAI streaming via edge function
  const connect = useCallback(async () => {
    if (!enabled) {
      console.log('⚠️ AssemblyAI streaming not enabled');
      return;
    }

    try {
      console.log('🔌 Connecting to AssemblyAI real-time streaming...');

      // Get Supabase credentials
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const projectId = supabaseUrl.split('//')[1].split('.')[0];
      
      // Build WebSocket URL with auth headers as query params (WebSocket doesn't support custom headers)
      const wsUrl = `wss://${projectId}.functions.supabase.co/assemblyai-realtime`;
      
      console.log('🌐 Connecting to:', wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connection established');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection') {
            if (data.status === 'connected') {
              toast.success('High Accuracy Mode active');
            }
          } else if (data.type === 'session_started') {
            setState(prev => ({ ...prev, sessionId: data.session_id }));
          } else if (data.type === 'partial') {
            if (onPartialTranscriptRef.current) {
              onPartialTranscriptRef.current(data.text);
            }
          } else if (data.type === 'final') {
            if (onFinalTranscriptRef.current) {
              onFinalTranscriptRef.current(data.text);
            }
          } else if (data.type === 'error') {
            console.error('❌ Streaming error:', data.message);
            setState(prev => ({ ...prev, error: data.message }));
            if (onErrorRef.current) {
              onErrorRef.current(data.message);
            }
          } else if (data.type === 'session_ended') {
            console.log('🛑 Streaming session ended');
            setState(prev => ({ ...prev, isStreaming: false }));
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection error',
          isConnected: false,
        }));
        if (onErrorRef.current) {
          onErrorRef.current('WebSocket connection error');
        }
      };

      wsRef.current.onclose = () => {
        console.log('🛑 WebSocket connection closed');
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isStreaming: false,
        }));
      };
    } catch (error) {
      console.error('❌ Error connecting:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMsg }));
      if (onErrorRef.current) {
        onErrorRef.current(errorMsg);
      }
    }
  }, [enabled]);

  // Start streaming audio
  const startStreaming = useCallback(async () => {
    if (!state.isConnected || !wsRef.current) {
      console.warn('⚠️ Not connected to streaming service');
      return;
    }

    try {
      console.log('🎤 Starting audio streaming...');

      // Get microphone access with optimized settings for speaker playback
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false, // Disabled for speaker audio
          noiseSuppression: false,  // Disabled to preserve speech
          autoGainControl: true,    // Enabled to boost speaker audio
        },
      });

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      // Process audio chunks
      processorRef.current.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        // Skip processing if paused
        if (state.isPaused) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16)
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const uint8Array = new Uint8Array(int16Array.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binary);

        // Send to AssemblyAI via WebSocket
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          audio: base64Audio,
        }));
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setState(prev => ({ ...prev, isStreaming: true }));
      console.log('✅ Audio streaming started');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMsg }));
      if (onErrorRef.current) {
        onErrorRef.current(errorMsg);
      }
    }
  }, [state.isConnected, state.isPaused]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    console.log('🛑 Stopping audio streaming...');

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminate' }));
    }

    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  // Pause streaming (mute audio processing)
  const pauseStreaming = useCallback(() => {
    console.log('⏸️ Pausing AssemblyAI streaming...');
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  // Resume streaming
  const resumeStreaming = useCallback(() => {
    console.log('▶️ Resuming AssemblyAI streaming...');
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    stopStreaming();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false,
      sessionId: null,
    }));
  }, [stopStreaming]);

  // Auto-connect when enabled (only once)
  useEffect(() => {
    if (enabled && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    }

    return () => {
      if (hasConnectedRef.current) {
        hasConnectedRef.current = false;
        disconnect();
      }
    };
  }, [enabled, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    pauseStreaming,
    resumeStreaming,
  };
}
