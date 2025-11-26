import { useState, useRef, useCallback } from 'react';
import { WhisperTranscription } from '@/utils/WhisperTranscription';
import { useAssemblyAIStreaming } from './useAssemblyAIStreaming';
import { useDeepgramStreaming } from './useDeepgramStreaming';
import { useOpenAIRealtime } from './useOpenAIRealtime';
import { MedicalAutoCorrector } from '@/utils/MedicalAutoCorrector';
import { toast } from 'sonner';

interface HybridTranscriptionConfig {
  sessionId?: string;
  mode?: 'whisper' | 'assemblyai' | 'deepgram' | 'openai-realtime' | 'auto';
  model?: string; // Specific model to use
  enableAutoCorrection?: boolean;
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
}

export function useHybridTranscription(config: HybridTranscriptionConfig = {}) {
  const {
    mode = 'auto',
    model = 'whisper-1',
    enableAutoCorrection = true,
    onTranscriptUpdate,
    onFinalTranscriptChunk,
  } = config;

  const [isActive, setIsActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<'whisper' | 'assemblyai' | 'deepgram' | 'openai-realtime'>('whisper');
  const [currentModel, setCurrentModel] = useState(model);
  const [stats, setStats] = useState({
    totalChunks: 0,
    correctedChunks: 0,
    avgLatency: 0,
  });

  const whisperRef = useRef<WhisperTranscription | null>(null);
  const autoCorrectorRef = useRef<MedicalAutoCorrector>(new MedicalAutoCorrector());

  // AssemblyAI streaming (real-time, <500ms latency)
  const assemblyAI = useAssemblyAIStreaming({
    enabled: currentMode === 'assemblyai' && isActive,
    onPartialTranscript: (text) => {
      if (onTranscriptUpdate) {
        onTranscriptUpdate(text, false);
      }
    },
    onFinalTranscript: async (text) => {
      const finalText = enableAutoCorrection 
        ? autoCorrectorRef.current.correctTranscript(text, 'patient')
        : text;

      if (onFinalTranscriptChunk) {
        onFinalTranscriptChunk(finalText);
      }
      if (onTranscriptUpdate) {
        onTranscriptUpdate(finalText, true);
      }

      setStats(prev => ({
        ...prev,
        totalChunks: prev.totalChunks + 1,
        correctedChunks: enableAutoCorrection ? prev.correctedChunks + 1 : prev.correctedChunks,
      }));
    },
    onError: (error) => {
      console.error('❌ AssemblyAI error:', error);
      toast.error('Streaming error: ' + error);
    },
  });

  // Deepgram streaming (medical-grade, multiple models)
  const deepgram = useDeepgramStreaming({
    enabled: currentMode === 'deepgram' && isActive,
    model: currentModel,
    onPartialTranscript: (text) => {
      if (onTranscriptUpdate) {
        onTranscriptUpdate(text, false);
      }
    },
    onFinalTranscript: async (text) => {
      const finalText = enableAutoCorrection 
        ? autoCorrectorRef.current.correctTranscript(text, 'patient')
        : text;

      if (onFinalTranscriptChunk) {
        onFinalTranscriptChunk(finalText);
      }
      if (onTranscriptUpdate) {
        onTranscriptUpdate(finalText, true);
      }

      setStats(prev => ({
        ...prev,
        totalChunks: prev.totalChunks + 1,
        correctedChunks: enableAutoCorrection ? prev.correctedChunks + 1 : prev.correctedChunks,
      }));
    },
    onError: (error) => {
      console.error('❌ Deepgram error:', error);
      toast.error('Streaming error: ' + error);
    },
  });

  // OpenAI Realtime (Silero VAD & Turn Detector)
  const openaiRealtime = useOpenAIRealtime({
    enabled: currentMode === 'openai-realtime' && isActive,
    model: currentModel,
    onPartialTranscript: (text) => {
      if (onTranscriptUpdate) {
        onTranscriptUpdate(text, false);
      }
    },
    onFinalTranscript: async (text) => {
      const finalText = enableAutoCorrection 
        ? autoCorrectorRef.current.correctTranscript(text, 'patient')
        : text;

      if (onFinalTranscriptChunk) {
        onFinalTranscriptChunk(finalText);
      }
      if (onTranscriptUpdate) {
        onTranscriptUpdate(finalText, true);
      }

      setStats(prev => ({
        ...prev,
        totalChunks: prev.totalChunks + 1,
        correctedChunks: enableAutoCorrection ? prev.correctedChunks + 1 : prev.correctedChunks,
      }));
    },
    onError: (error) => {
      console.error('❌ OpenAI Realtime error:', error);
      toast.error('Streaming error: ' + error);
    },
    onSpeechStart: () => {
      console.log('🎤 Speech detected by VAD');
    },
    onSpeechStop: () => {
      console.log('🛑 Speech ended (VAD)');
    },
  });

  // Start transcription
  const start = useCallback(async (stream: MediaStream): Promise<boolean> => {
    try {
      console.clear(); // Clear console for clarity
      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║                                                   ║');
      console.log('║        🎯 TRANSCRIPTION ENGINE STARTING           ║');
      console.log('║                                                   ║');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      console.log('📋 SELECTED MODEL:', currentModel);
      console.log('');

      // Determine which provider based on model
      let activeMode: 'whisper' | 'assemblyai' | 'deepgram' | 'openai-realtime' = 'whisper';
      let providerName = '';
      let apiEndpoint = '';
      
      // Route to correct provider based on model with comprehensive detection
      if (currentModel.startsWith('whisper-') || currentModel.startsWith('gpt-')) {
        activeMode = 'whisper';
        providerName = '🟦 OPENAI WHISPER';
        apiEndpoint = '/functions/v1/whisper-transcribe';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: OpenAI Whisper API (Batch)         ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT:', apiEndpoint.padEnd(32), '┃');
        console.log('┃  LATENCY: ~2-5 seconds per 10s segment        ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (currentModel.startsWith('assemblyai-')) {
        activeMode = 'assemblyai';
        providerName = '🟩 ASSEMBLYAI';
        apiEndpoint = 'wss://api.assemblyai.com/v2/realtime/ws';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: AssemblyAI Streaming (Real-Time)   ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <500ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (currentModel.includes('nova') || currentModel === 'enhanced' || currentModel === 'whisper-large') {
        activeMode = 'deepgram';
        providerName = '🟪 DEEPGRAM';
        apiEndpoint = 'wss://api.deepgram.com/v1/listen';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: Deepgram Streaming (Medical-Grade) ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <300ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (currentModel.includes('silero') || currentModel.includes('turn_detector')) {
        activeMode = 'openai-realtime';
        providerName = '🟨 OPENAI REALTIME';
        apiEndpoint = 'wss://api.openai.com/v1/realtime';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: OpenAI Realtime API with VAD       ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <100ms (ultra real-time)            ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (mode === 'assemblyai') {
        activeMode = 'assemblyai';
        providerName = '🟩 ASSEMBLYAI';
        apiEndpoint = 'wss://api.assemblyai.com/v2/realtime/ws';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: AssemblyAI (Mode Override)         ┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <500ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (mode === 'auto') {
        activeMode = 'deepgram';
        providerName = '🟪 DEEPGRAM';
        apiEndpoint = 'wss://api.deepgram.com/v1/listen';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  PROVIDER: Deepgram (Auto Mode Default)       ┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <300ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      }

      console.log('');

      setCurrentMode(activeMode);
      setCurrentModel(currentModel);
      setIsActive(true);

      if (activeMode === 'openai-realtime') {
        // OpenAI Realtime with VAD (Silero/Turn Detector)
        console.log('▶️ Starting OpenAI Realtime connection...');
        if (!openaiRealtime.isConnected) {
          await openaiRealtime.connect();
        }
        await openaiRealtime.startStreaming();
        console.log('✅ OpenAI Realtime streaming active with', currentModel);
        toast.success(`🎯 ${currentModel} active - Ultra-low latency VAD (<100ms)`, { duration: 3000 });
      } else if (activeMode === 'assemblyai') {
        // AssemblyAI Real-Time Streaming
        console.log('▶️ Starting AssemblyAI connection...');
        if (!assemblyAI.isConnected) {
          await assemblyAI.connect();
        }
        await assemblyAI.startStreaming();
        const modelName = currentModel === 'assemblyai-best' ? 'Best (Highest Accuracy)' : 
                         currentModel === 'assemblyai-nano' ? 'Nano (Fastest)' : 'Real-Time';
        console.log('✅ AssemblyAI streaming active with', modelName);
        toast.success(`🎯 AssemblyAI ${modelName} active (<500ms latency)`, { duration: 3000 });
      } else if (activeMode === 'deepgram') {
        // Deepgram Medical & Nova Models
        console.log('▶️ Starting Deepgram connection...');
        if (!deepgram.isConnected) {
          await deepgram.connect();
        }
        await deepgram.startStreaming();
        const isMedical = currentModel.includes('medical');
        console.log('✅ Deepgram streaming active with', currentModel, isMedical ? '(Medical Grade)' : '');
        toast.success(`🎯 Deepgram ${currentModel} active${isMedical ? ' - Medical Grade' : ''} (<300ms latency)`, { duration: 3000 });
      } else {
        // OpenAI Whisper Batch Processing
        console.log('▶️ Starting OpenAI Whisper batch transcription...');
        whisperRef.current = new WhisperTranscription({
          language: 'en',
          mode: 'direct',
          model: currentModel,
          onResult: async (text, isFinal) => {
            const finalText = enableAutoCorrection && isFinal
              ? autoCorrectorRef.current.correctTranscript(text, 'patient')
              : text;

            if (isFinal && onFinalTranscriptChunk) {
              onFinalTranscriptChunk(finalText);
            }
            if (onTranscriptUpdate) {
              onTranscriptUpdate(finalText, isFinal);
            }

            if (isFinal) {
              setStats(prev => ({
                ...prev,
                totalChunks: prev.totalChunks + 1,
                correctedChunks: enableAutoCorrection ? prev.correctedChunks + 1 : prev.correctedChunks,
              }));
            }
          },
          onError: (error) => {
            console.error('❌ Whisper error:', error);
            toast.error('Transcription error: ' + error);
          },
        });

        await whisperRef.current.start(stream);
        const modelDisplay = currentModel === 'whisper-1' ? 'Whisper-1 (Standard)' : 
                            currentModel === 'gpt-4o-mini-transcribe' ? 'GPT-4o Mini (Advanced)' : currentModel;
        console.log('✅ OpenAI Whisper batch processing active with', modelDisplay);
        toast.success(`🎯 OpenAI ${modelDisplay} active (10s batch processing)`, { duration: 3000 });
      }

      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║                                                   ║');
      console.log('║        ✅ TRANSCRIPTION ACTIVE & RUNNING          ║');
      console.log('║                                                   ║');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      console.log('📊 ACTIVE PROVIDER:', providerName);
      console.log('📊 ACTIVE MODEL:', currentModel);
      console.log('📊 API ENDPOINT:', apiEndpoint);
      console.log('📊 MODE:', mode);
      console.log('');
      console.log('🎤 Listening for audio input...');
      console.log('');

      return true;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      setIsActive(false);
      return false;
    }
  }, [mode, currentModel, enableAutoCorrection, assemblyAI, deepgram, openaiRealtime, onTranscriptUpdate, onFinalTranscriptChunk]);

  // Stop transcription
  const stop = useCallback(() => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║        🛑 STOPPING TRANSCRIPTION ENGINE           ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 STOPPING PROVIDER:', currentMode.toUpperCase());
    console.log('');

    if (currentMode === 'openai-realtime') {
      openaiRealtime.stopStreaming();
      openaiRealtime.disconnect();
      console.log('✅ 🟨 OpenAI Realtime stopped and disconnected');
    } else if (currentMode === 'deepgram') {
      deepgram.stopStreaming();
      deepgram.disconnect();
      console.log('✅ 🟪 Deepgram stopped and disconnected');
    } else if (currentMode === 'assemblyai') {
      assemblyAI.stopStreaming();
      assemblyAI.disconnect();
      console.log('✅ 🟩 AssemblyAI stopped and disconnected');
    } else if (whisperRef.current) {
      whisperRef.current.stop();
      whisperRef.current.destroy();
      whisperRef.current = null;
      console.log('✅ 🟦 OpenAI Whisper stopped');
    }

    setIsActive(false);
    console.log('');
    console.log('🏁 Transcription session ended');
    console.log('');
  }, [currentMode, assemblyAI, deepgram, openaiRealtime]);

  // Pause transcription
  const pause = useCallback(() => {
    if (currentMode === 'openai-realtime') {
      openaiRealtime.pauseStreaming();
    } else if (currentMode === 'deepgram') {
      deepgram.pauseStreaming();
    } else if (currentMode === 'assemblyai') {
      assemblyAI.pauseStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.pause();
    }
  }, [currentMode, assemblyAI, deepgram, openaiRealtime]);

  // Resume transcription
  const resume = useCallback(() => {
    if (currentMode === 'openai-realtime') {
      openaiRealtime.resumeStreaming();
    } else if (currentMode === 'deepgram') {
      deepgram.resumeStreaming();
    } else if (currentMode === 'assemblyai') {
      assemblyAI.resumeStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.resume();
    }
  }, [currentMode, assemblyAI, deepgram, openaiRealtime]);

  // Switch transcription model
  const switchModel = useCallback((newModel: string) => {
    if (!isActive) {
      setCurrentModel(newModel);
      toast.info(`Switched to ${newModel}`);
    } else {
      toast.error('Cannot switch model while transcription is active');
    }
  }, [isActive]);

  return {
    isActive,
    currentMode,
    currentModel,
    stats,
    start,
    stop,
    pause,
    resume,
    switchModel,
    isStreaming: (currentMode === 'assemblyai' && assemblyAI.isStreaming) || 
                 (currentMode === 'deepgram' && deepgram.isStreaming) ||
                 (currentMode === 'openai-realtime' && openaiRealtime.isStreaming),
    isConnected: (currentMode === 'assemblyai' && assemblyAI.isConnected) ||
                 (currentMode === 'deepgram' && deepgram.isConnected) ||
                 (currentMode === 'openai-realtime' && openaiRealtime.isConnected),
    isSpeaking: currentMode === 'openai-realtime' ? openaiRealtime.isSpeaking : false,
  };
}
