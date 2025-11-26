import { useState, useRef, useCallback, useEffect } from 'react';

interface RealtimeOptions {
  enabled?: boolean;
  model?: string; // silero-vad-1, silero-vad-2, turn_detector_v1, turn_detector_v2
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onSpeechStart?: () => void;
  onSpeechStop?: () => void;
}

interface RealtimeState {
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  sessionId: string | null;
  isSpeaking: boolean;
}

export function useOpenAIRealtime(options: RealtimeOptions = {}) {
  const {
    enabled = false,
    model = 'silero-vad-1',
    onPartialTranscript,
    onFinalTranscript,
    onError,
    onSpeechStart,
    onSpeechStop,
  } = options;

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isStreaming: false,
    isPaused: false,
    error: null,
    sessionId: null,
    isSpeaking: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Map model name to VAD type
  const getVADType = (modelName: string): string => {
    if (modelName.includes('silero')) {
      return 'server_vad';
    } else if (modelName.includes('turn_detector')) {
      return 'server_vad'; // OpenAI uses server_vad for all VAD types
    }
    return 'server_vad';
  };

  const connect = useCallback(async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'atlszopzpkouueqefbbz';
      const vadType = getVADType(model);
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/openai-realtime?model=gpt-4o-realtime-preview-2024-12-17&vad=${vadType}`;
      
      console.log(`🔌 Connecting to OpenAI Realtime (${model})...`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Connected to OpenAI Realtime (${model})`);
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'partial' && onPartialTranscript) {
            onPartialTranscript(data.text);
          } else if (data.type === 'final' && onFinalTranscript) {
            onFinalTranscript(data.text);
          } else if (data.type === 'speech_started') {
            setState(prev => ({ ...prev, isSpeaking: true }));
            if (onSpeechStart) onSpeechStart();
          } else if (data.type === 'speech_stopped') {
            setState(prev => ({ ...prev, isSpeaking: false }));
            if (onSpeechStop) onSpeechStop();
          } else if (data.type === 'error' && onError) {
            onError(data.message);
          } else if (data.type === 'connection') {
            console.log(`📡 OpenAI ${data.status}: ${data.message || ''}`);
            if (data.status === 'connected') {
              setState(prev => ({ ...prev, sessionId: data.model }));
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ OpenAI Realtime WebSocket error:', error);
        const errorMsg = 'Connection error';
        setState(prev => ({ ...prev, error: errorMsg }));
        if (onError) onError(errorMsg);
      };

      ws.onclose = () => {
        console.log('🛑 OpenAI Realtime disconnected');
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
  }, [model, onPartialTranscript, onFinalTranscript, onError, onSpeechStart, onSpeechStop]);

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
      sessionId: null,
      isSpeaking: false,
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
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
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
      console.log('🎙️ Streaming audio to OpenAI Realtime...');
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

    setState(prev => ({ ...prev, isStreaming: false, isPaused: false, isSpeaking: false }));
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
