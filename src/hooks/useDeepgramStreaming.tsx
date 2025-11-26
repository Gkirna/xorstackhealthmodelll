import { useState, useRef, useCallback, useEffect } from 'react';

interface StreamingOptions {
  enabled?: boolean;
  model?: string;
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  sessionId: string | null;
}

export function useDeepgramStreaming(options: StreamingOptions = {}) {
  const {
    enabled = false,
    model = 'nova-2',
    onPartialTranscript,
    onFinalTranscript,
    onError,
  } = options;

  const [state, setState] = useState<StreamingState>({
    isConnected: false,
    isStreaming: false,
    isPaused: false,
    error: null,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const connect = useCallback(async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'atlszopzpkouueqefbbz';
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/deepgram-realtime?model=${model}`;
      
      console.log(`🔌 Connecting to Deepgram (${model})...`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Connected to Deepgram (${model})`);
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'partial' && onPartialTranscript) {
            onPartialTranscript(data.text);
          } else if (data.type === 'final' && onFinalTranscript) {
            onFinalTranscript(data.text);
          } else if (data.type === 'session_started') {
            setState(prev => ({ ...prev, sessionId: data.request_id }));
          } else if (data.type === 'error' && onError) {
            onError(data.message);
          } else if (data.type === 'connection') {
            console.log(`📡 Deepgram ${data.status}: ${data.message || ''}`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        const errorMsg = 'Connection error';
        setState(prev => ({ ...prev, error: errorMsg }));
        if (onError) onError(errorMsg);
      };

      ws.onclose = () => {
        console.log('🛑 Deepgram disconnected');
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isStreaming: false 
        }));
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({ ...prev, error: errorMsg }));
      if (onError) onError(errorMsg);
    }
  }, [model, onPartialTranscript, onFinalTranscript, onError]);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminate' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    
    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isStreaming: false,
      sessionId: null 
    }));
  }, []);

  const startStreaming = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!state.isPaused && wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          const uint8Array = new Uint8Array(pcm16.buffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);

          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64,
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setState(prev => ({ ...prev, isStreaming: true }));
      console.log('🎙️ Streaming audio to Deepgram...');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      const errorMsg = error instanceof Error ? error.message : 'Microphone access denied';
      setState(prev => ({ ...prev, error: errorMsg }));
      if (onError) onError(errorMsg);
    }
  }, [state.isPaused, onError]);

  const stopStreaming = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState(prev => ({ ...prev, isStreaming: false, isPaused: false }));
    console.log('🛑 Stopped streaming audio');
  }, []);

  const pauseStreaming = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeStreaming = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  useEffect(() => {
    if (enabled && !state.isConnected) {
      connect();
    }

    return () => {
      stopStreaming();
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
