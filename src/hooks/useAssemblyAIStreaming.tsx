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

  // Connect to AssemblyAI streaming via edge function
  const connect = useCallback(async () => {
    if (!enabled) {
      console.log('⚠️ AssemblyAI streaming not enabled');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        console.log('🔌 Connecting to AssemblyAI real-time streaming...');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const projectId = supabaseUrl.split('//')[1].split('.')[0];
        const wsUrl = `wss://${projectId}.supabase.co/functions/v1/assemblyai-realtime`;

        console.log('🌐 WebSocket URL:', wsUrl);

        let isResolved = false;

        // Create WebSocket connection (no auth needed - JWT verification disabled)
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('📡 WebSocket to edge function opened, waiting for AssemblyAI connection...');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Wait for confirmation from edge function that it connected to AssemblyAI
            if (data.type === 'connection' && data.status === 'connected' && !isResolved) {
              console.log('✅ Connected to AssemblyAI:', data.message);
              setState(prev => ({ ...prev, isConnected: true, error: null }));
              toast.success('High Accuracy Mode active');
              isResolved = true;
              resolve();
            } else if (data.type === 'session_started' && !isResolved) {
              console.log('✅ AssemblyAI session started:', data.session_id);
              setState(prev => ({ ...prev, isConnected: true, sessionId: data.session_id }));
              isResolved = true;
              resolve();
            }
            
            // Handle transcription and other messages
            if (data.type === 'partial') {
              if (onPartialTranscript) {
                onPartialTranscript(data.text);
              }
            } else if (data.type === 'final') {
              if (onFinalTranscript) {
                onFinalTranscript(data.text);
              }
            } else if (data.type === 'error') {
              console.error('❌ Streaming error:', data.message);
              setState(prev => ({ ...prev, error: data.message }));
              if (onError) {
                onError(data.message);
              }
              if (!isResolved) {
                reject(new Error(data.message));
                isResolved = true;
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
          const errorMsg = 'WebSocket connection error';
          setState(prev => ({ 
            ...prev, 
            error: errorMsg,
            isConnected: false,
          }));
          if (onError) {
            onError(errorMsg);
          }
          if (!isResolved) {
            reject(new Error(errorMsg));
            isResolved = true;
          }
        };

        wsRef.current.onclose = () => {
          console.log('🛑 WebSocket connection closed');
          setState(prev => ({ 
            ...prev, 
            isConnected: false,
            isStreaming: false,
          }));
          if (!isResolved) {
            reject(new Error('Connection closed before ready'));
            isResolved = true;
          }
        };

      } catch (error) {
        console.error('❌ Error connecting:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, error: errorMsg }));
        if (onError) {
          onError(errorMsg);
        }
        reject(error);
      }
    });
  }, [enabled, onPartialTranscript, onFinalTranscript, onError]);

  // Start streaming audio
  const startStreaming = useCallback(async () => {
    if (!state.isConnected || !wsRef.current) {
      console.warn('⚠️ Not connected to streaming service');
      return;
    }

    try {
      console.log('🎤 Starting audio streaming...');

      // Get microphone access
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      // Process audio chunks
      processorRef.current.onaudioprocess = (e) => {
        // Skip if paused, but keep connection alive
        if (state.isPaused) {
          return;
        }
        
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
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
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [state.isConnected, onError]);

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

  // Pause streaming (keep connection alive)
  const pauseStreaming = useCallback(() => {
    console.log('⏸️ Pausing streaming (keeping connection alive)');
    setState(prev => ({ ...prev, isPaused: true }));
    toast.info('Transcription paused');
  }, []);

  // Resume streaming
  const resumeStreaming = useCallback(() => {
    console.log('▶️ Resuming streaming');
    setState(prev => ({ ...prev, isPaused: false }));
    toast.success('Transcription resumed');
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
      isPaused: false,
      sessionId: null,
    }));
  }, [stopStreaming]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && !state.isConnected) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

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
