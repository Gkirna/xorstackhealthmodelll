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
  const [currentModel, setCurrentModel] = useState(model);
  const [stats, setStats] = useState({
    totalChunks: 0,
    correctedChunks: 0,
    avgLatency: 0,
  });

  const whisperRef = useRef<WhisperTranscription | null>(null);
  const autoCorrectorRef = useRef<MedicalAutoCorrector>(new MedicalAutoCorrector());

  // Determine provider based on current model
  const getProviderFromModel = useCallback((modelName: string): 'whisper' | 'assemblyai' | 'deepgram' | 'openai-realtime' => {
    if (modelName.startsWith('whisper-') || modelName.startsWith('gpt-')) {
      return 'whisper';
    } else if (modelName.startsWith('assemblyai-')) {
      return 'assemblyai';
    } else if (modelName.includes('nova') || modelName === 'enhanced' || modelName === 'whisper-large') {
      return 'deepgram';
    } else if (modelName.includes('silero') || modelName.includes('turn_detector')) {
      return 'openai-realtime';
    } else if (mode === 'assemblyai') {
      return 'assemblyai';
    } else if (mode === 'auto') {
      return 'deepgram';
    }
    return 'whisper';
  }, [mode]);

  const currentProvider = getProviderFromModel(currentModel);

  // AssemblyAI streaming (real-time, <500ms latency)
  const assemblyAI = useAssemblyAIStreaming({
    enabled: currentProvider === 'assemblyai' && isActive,
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
    enabled: currentProvider === 'deepgram' && isActive,
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
    enabled: currentProvider === 'openai-realtime' && isActive,
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
      console.clear();
      
      const activeProvider = getProviderFromModel(currentModel);
      
      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║                                                   ║');
      console.log('║        🎯 TRANSCRIPTION ENGINE STARTING           ║');
      console.log('║                                                   ║');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      console.log('📋 SELECTED MODEL:', currentModel);
      console.log('📋 DETERMINED PROVIDER:', activeProvider.toUpperCase());
      console.log('');

      let providerName = '';
      let apiEndpoint = '';
      
      if (activeProvider === 'whisper') {
        providerName = '🟦 OPENAI WHISPER';
        apiEndpoint = '/functions/v1/whisper-transcribe';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  ✅ ACTIVE: OpenAI Whisper API (Batch)        ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT:', apiEndpoint.padEnd(32), '┃');
        console.log('┃  LATENCY: ~2-5 seconds per 10s segment        ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (activeProvider === 'assemblyai') {
        providerName = '🟩 ASSEMBLYAI';
        apiEndpoint = 'wss://api.assemblyai.com/v2/realtime/ws';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  ✅ ACTIVE: AssemblyAI Streaming (Real-Time)  ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <500ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (activeProvider === 'deepgram') {
        providerName = '🟪 DEEPGRAM';
        apiEndpoint = 'wss://api.deepgram.com/v1/listen';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  ✅ ACTIVE: Deepgram Streaming (Medical-Grade)┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <300ms (real-time)                  ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      } else if (activeProvider === 'openai-realtime') {
        providerName = '🟨 OPENAI REALTIME';
        apiEndpoint = 'wss://api.openai.com/v1/realtime';
        console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
        console.log('┃  ✅ ACTIVE: OpenAI Realtime API with VAD      ┃');
        console.log('┃  MODEL:', currentModel.padEnd(36), '┃');
        console.log('┃  ENDPOINT: WebSocket Streaming                ┃');
        console.log('┃  LATENCY: <100ms (ultra real-time)            ┃');
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      }

      console.log('');
      setIsActive(true);

      if (activeProvider === 'openai-realtime') {
        // OpenAI Realtime with VAD (Silero/Turn Detector)
        console.log('▶️ Starting OpenAI Realtime connection...');
        if (!openaiRealtime.isConnected) {
          await openaiRealtime.connect();
        }
        await openaiRealtime.startStreaming();
        console.log('✅ OpenAI Realtime streaming active with', currentModel);
        toast.success(`🎯 ${currentModel} active - Ultra-low latency VAD (<100ms)`, { duration: 3000 });
      } else if (activeProvider === 'assemblyai') {
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
      } else if (activeProvider === 'deepgram') {
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
      console.log('📊 DETERMINED FROM MODEL NAME:', activeProvider.toUpperCase());
      console.log('📊 API ENDPOINT:', apiEndpoint);
      console.log('');
      console.log('🎤 Listening for audio input...');
      console.log('');
      console.log('🔊 THIS PROVIDER IS NOW TRANSCRIBING YOUR AUDIO!');
      console.log('');

      return true;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      setIsActive(false);
      return false;
    }
  }, [mode, currentModel, enableAutoCorrection, assemblyAI, deepgram, openaiRealtime, onTranscriptUpdate, onFinalTranscriptChunk, getProviderFromModel]);

  // Stop transcription
  const stop = useCallback(() => {
    const activeProvider = getProviderFromModel(currentModel);
    
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║        🛑 STOPPING TRANSCRIPTION ENGINE           ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 STOPPING PROVIDER:', activeProvider.toUpperCase());
    console.log('');

    if (activeProvider === 'openai-realtime') {
      openaiRealtime.stopStreaming();
      openaiRealtime.disconnect();
      console.log('✅ 🟨 OpenAI Realtime stopped and disconnected');
    } else if (activeProvider === 'deepgram') {
      deepgram.stopStreaming();
      deepgram.disconnect();
      console.log('✅ 🟪 Deepgram stopped and disconnected');
    } else if (activeProvider === 'assemblyai') {
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
  }, [currentModel, assemblyAI, deepgram, openaiRealtime, getProviderFromModel]);

  // Pause transcription
  const pause = useCallback(() => {
    const activeProvider = getProviderFromModel(currentModel);
    if (activeProvider === 'openai-realtime') {
      openaiRealtime.pauseStreaming();
    } else if (activeProvider === 'deepgram') {
      deepgram.pauseStreaming();
    } else if (activeProvider === 'assemblyai') {
      assemblyAI.pauseStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.pause();
    }
  }, [currentModel, assemblyAI, deepgram, openaiRealtime, getProviderFromModel]);

  // Resume transcription
  const resume = useCallback(() => {
    const activeProvider = getProviderFromModel(currentModel);
    if (activeProvider === 'openai-realtime') {
      openaiRealtime.resumeStreaming();
    } else if (activeProvider === 'deepgram') {
      deepgram.resumeStreaming();
    } else if (activeProvider === 'assemblyai') {
      assemblyAI.resumeStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.resume();
    }
  }, [currentModel, assemblyAI, deepgram, openaiRealtime, getProviderFromModel]);

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
    currentMode: currentProvider,
    currentModel,
    stats,
    start,
    stop,
    pause,
    resume,
    switchModel,
    isStreaming: (currentProvider === 'assemblyai' && assemblyAI.isStreaming) || 
                 (currentProvider === 'deepgram' && deepgram.isStreaming) ||
                 (currentProvider === 'openai-realtime' && openaiRealtime.isStreaming),
    isConnected: (currentProvider === 'assemblyai' && assemblyAI.isConnected) ||
                 (currentProvider === 'deepgram' && deepgram.isConnected) ||
                 (currentProvider === 'openai-realtime' && openaiRealtime.isConnected),
    isSpeaking: currentProvider === 'openai-realtime' ? openaiRealtime.isSpeaking : false,
  };
}
