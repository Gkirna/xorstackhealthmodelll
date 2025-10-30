import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TranscriptionSegment } from '@/types/advancedTranscription';

interface TranscriptionState {
  isConnected: boolean;
  isTranscribing: boolean;
  interimText: string;
  finalText: string;
  segments: Array<{ text: string; speaker?: number; timestamp: number }>;
  confidence: number;
}

const SAMPLE_RATE = 24000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
const PROJECT_REF = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];

export const useWebSocketTranscription = (sessionId: string) => {
  const [state, setState] = useState<TranscriptionState>({
    isConnected: false,
    isTranscribing: false,
    interimText: '',
    finalText: '',
    segments: [],
    confidence: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Encode audio to base64
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

  // Start transcription
  const startTranscription = useCallback(async () => {
    try {
      console.log('🎤 Starting WebSocket-based real-time transcription...');

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Connect to WebSocket edge function
      const wsUrl = `wss://${PROJECT_REF}.supabase.co/functions/v1/realtime-stream-websocket`;
      console.log('🔌 Connecting to:', wsUrl);

      wsRef.current = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      } as any);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));
        toast.success('Connected to transcription service');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received:', message.type);

          if (message.type === 'transcript_interim') {
            setState(prev => ({
              ...prev,
              interimText: message.text,
              confidence: message.confidence || prev.confidence,
            }));
          } else if (message.type === 'transcript_final') {
            const newSegment = {
              text: message.text,
              speaker: message.speaker,
              timestamp: Date.now(),
            };

            setState(prev => ({
              ...prev,
              finalText: prev.finalText ? `${prev.finalText} ${message.text}` : message.text,
              segments: [...prev.segments, newSegment],
              interimText: '',
              confidence: message.confidence || prev.confidence,
            }));

            console.log(`✅ Final transcript: "${message.text}"`);
          } else if (message.type === 'error') {
            console.error('❌ Transcription error:', message.message);
            toast.error(message.message || 'Transcription error');
          } else if (message.type === 'connection') {
            console.log(`🔌 Connection status: ${message.status}`);
            if (message.status === 'connected') {
              toast.success(message.message || 'Ready to transcribe');
            }
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast.error('Connection error');
        setState(prev => ({ ...prev, isConnected: false, isTranscribing: false }));
      };

      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket closed');
        setState(prev => ({ ...prev, isConnected: false, isTranscribing: false }));
      };

      // Wait for WebSocket to connect
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        const checkConnection = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearTimeout(timeout);
            clearInterval(checkConnection);
            resolve(true);
          }
        }, 100);
      });

      // Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('🎤 Microphone access granted');
      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      let chunkCount = 0;
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const audioData = e.inputBuffer.getChannelData(0);
          const base64Audio = encodeAudioToBase64(new Float32Array(audioData));
          
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          }));

          chunkCount++;
          if (chunkCount % 50 === 0) {
            console.log(`🎵 Sent ${chunkCount} audio chunks`);
          }
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setState(prev => ({ ...prev, isTranscribing: true }));
      console.log('✅ Real-time transcription started');
      toast.success('Listening... speak now!');

    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start transcription');
      throw error;
    }
  }, [encodeAudioToBase64]);

  // Stop transcription
  const stopTranscription = useCallback(async () => {
    console.log('⏹️ Stopping transcription...');

    // Send stop signal to get final results
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      
      // Wait a bit for final results
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clean up audio
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

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isTranscribing: false,
      isConnected: false,
    }));

    console.log('🛑 Transcription stopped');
    toast.success('Transcription completed');
  }, []);

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
  };
};
