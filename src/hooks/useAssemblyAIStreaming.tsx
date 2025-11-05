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
    error: null,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const hasConnectedRef = useRef<boolean>(false);
  
  // Use refs for callbacks to prevent re-renders
  const onPartialTranscriptRef = useRef(onPartialTranscript);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  
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

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('⚠️ Already connected to AssemblyAI');
      return;
    }

    try {
      console.log('🔌 Connecting to AssemblyAI real-time streaming...');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectId = supabaseUrl.split('//')[1].split('.')[0];
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/assemblyai-realtime`;

      console.log('🌐 WebSocket URL:', wsUrl);
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
            // Don't stop streaming on session_ended - let user control it
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
  const startStreaming = useCallback(async (deviceId?: string) => {
    if (!state.isConnected || !wsRef.current) {
      console.warn('⚠️ Not connected to streaming service');
      return;
    }

    if (state.isStreaming) {
      console.log('⚠️ Already streaming, ignoring duplicate start');
      return;
    }

    try {
      console.log('🎤 Starting audio streaming with device:', deviceId || 'default');

      // Get microphone access with optimal constraints for transcription
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // Add device ID if provided (supports all microphone types: built-in, headset, USB)
      if (deviceId && deviceId !== 'default') {
        audioConstraints.deviceId = { exact: deviceId };
      }

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      console.log('✅ Microphone access granted');

      // Create audio context with optimal settings
      audioContextRef.current = new AudioContext({ 
        sampleRate: 16000,
        latencyHint: 'interactive' // Low latency for real-time
      });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      // Use 4096 buffer size for good balance between latency and reliability
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      // Process audio chunks with optimized conversion
      processorRef.current.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !state.isStreaming) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16) with clamping
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64 efficiently
        const uint8Array = new Uint8Array(int16Array.buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Audio = btoa(binary);

        // Send to AssemblyAI via WebSocket
        try {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          }));
        } catch (error) {
          console.error('❌ Error sending audio:', error);
        }
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setState(prev => ({ ...prev, isStreaming: true }));
      console.log('✅ Audio streaming started');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide user-friendly error messages
      let friendlyError = errorMsg;
      if (errorMsg.includes('Permission denied')) {
        friendlyError = 'Microphone access denied. Please allow microphone permissions.';
      } else if (errorMsg.includes('not found') || errorMsg.includes('OverconstrainedError')) {
        friendlyError = 'Selected microphone not found. Please choose another microphone.';
      }
      
      setState(prev => ({ ...prev, error: friendlyError }));
      if (onErrorRef.current) {
        onErrorRef.current(friendlyError);
      }
    }
  }, [state.isConnected, state.isStreaming]);

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
    console.log('🛑 Disconnecting from AssemblyAI...');
    stopStreaming();

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false,
      sessionId: null,
    }));
    
    hasConnectedRef.current = false;
  }, [stopStreaming]);

  // Auto-connect when enabled (only once)
  useEffect(() => {
    if (enabled && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    }

    return () => {
      // Only disconnect if component is truly unmounting
      // Don't disconnect on re-renders
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
  };
}
