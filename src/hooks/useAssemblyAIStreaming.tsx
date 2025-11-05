import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface StreamingOptions {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
  language?: string;
  deviceId?: string;
}

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
}

export function useAssemblyAIStreaming(options: StreamingOptions = {}) {
  const {
    onPartialTranscript,
    onFinalTranscript,
    onError,
    enabled = false,
    language = 'en',
    deviceId,
  } = options;

  const [state, setState] = useState<StreamingState>({
    isConnected: false,
    isStreaming: false,
    error: null,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const hasConnectedRef = useRef(false);

  // Connect to AssemblyAI streaming via edge function
  const connect = useCallback(async () => {
    if (!enabled) {
      console.log('⚠️ AssemblyAI streaming not enabled');
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ Already connected to AssemblyAI');
      return;
    }

    try {
      console.log('🔌 Connecting to AssemblyAI real-time streaming with language:', language);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectId = supabaseUrl.split('//')[1].split('.')[0];
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/assemblyai-realtime?language=${language}`;

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
        if (onError) {
          onError('WebSocket connection error');
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
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [enabled, onPartialTranscript, onFinalTranscript, onError]);

  // Start streaming audio
  const startStreaming = useCallback(async (sourceDeviceId?: string) => {
    if (!state.isConnected || !wsRef.current) {
      console.warn('⚠️ Not connected to streaming service');
      return;
    }

    try {
      console.log('🎤 Starting audio streaming with device:', sourceDeviceId || deviceId || 'default');

      // Audio constraints for capturing audio
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // If a specific device is provided, use it
      if (sourceDeviceId || deviceId) {
        audioConstraints.deviceId = { exact: sourceDeviceId || deviceId };
      }

      // Get audio access (microphone or system audio)
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
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
      toast.success('Real-time transcription active');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMsg }));
      if (onError) {
        onError(errorMsg);
      }
      toast.error('Failed to start audio capture: ' + errorMsg);
    }
  }, [state.isConnected, deviceId, onError]);

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
    
    // Reset connection flag
    hasConnectedRef.current = false;
  }, [stopStreaming]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && !state.isConnected && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    }

    // Only disconnect on unmount
    return () => {
      if (enabled) {
        disconnect();
        hasConnectedRef.current = false;
      }
    };
  }, [enabled]); // Only depend on enabled changing

  return {
    ...state,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
  };
}
