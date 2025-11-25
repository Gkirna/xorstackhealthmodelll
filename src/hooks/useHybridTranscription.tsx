import { useState, useRef, useCallback } from 'react';
import { WhisperTranscription } from '@/utils/WhisperTranscription';
import { useAssemblyAIStreaming } from './useAssemblyAIStreaming';
import { MedicalAutoCorrector } from '@/utils/MedicalAutoCorrector';
import { toast } from 'sonner';

interface HybridTranscriptionConfig {
  sessionId?: string;
  mode?: 'whisper' | 'assemblyai' | 'auto';
  enableAutoCorrection?: boolean;
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
}

export function useHybridTranscription(config: HybridTranscriptionConfig = {}) {
  const {
    mode = 'auto',
    enableAutoCorrection = true,
    onTranscriptUpdate,
    onFinalTranscriptChunk,
  } = config;

  const [isActive, setIsActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<'whisper' | 'assemblyai'>('whisper');
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
      // Auto-correct medical terms
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

  // Start transcription
  const start = useCallback(async (stream: MediaStream): Promise<boolean> => {
    try {
      console.log('🚀 Starting hybrid transcription:', { mode, currentMode });

      // Determine which mode to use
      let activeMode = currentMode;
      if (mode === 'auto') {
        // Auto-select best mode based on available features
        // AssemblyAI for real-time, Whisper for high accuracy
        activeMode = 'assemblyai'; // Default to streaming for best UX
      } else if (mode === 'whisper' || mode === 'assemblyai') {
        activeMode = mode;
      }

      setCurrentMode(activeMode);
      setIsActive(true);

      if (activeMode === 'assemblyai') {
        // Connect and start streaming
        if (!assemblyAI.isConnected) {
          await assemblyAI.connect();
        }
        await assemblyAI.startStreaming();
        toast.success('🎯 Real-time transcription active (<500ms latency)');
      } else {
        // Use Whisper batch processing
        whisperRef.current = new WhisperTranscription({
          language: 'en',
          mode: 'direct',
          onResult: async (text, isFinal) => {
            // Auto-correct if enabled
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
        toast.success('🎯 High-accuracy mode active (10s latency)');
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      setIsActive(false);
      return false;
    }
  }, [mode, currentMode, enableAutoCorrection, assemblyAI, onTranscriptUpdate, onFinalTranscriptChunk]);

  // Stop transcription
  const stop = useCallback(() => {
    console.log('🛑 Stopping hybrid transcription');

    if (currentMode === 'assemblyai') {
      assemblyAI.stopStreaming();
      assemblyAI.disconnect();
    } else if (whisperRef.current) {
      whisperRef.current.stop();
      whisperRef.current.destroy();
      whisperRef.current = null;
    }

    setIsActive(false);
  }, [currentMode, assemblyAI]);

  // Pause transcription
  const pause = useCallback(() => {
    if (currentMode === 'assemblyai') {
      assemblyAI.pauseStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.pause();
    }
  }, [currentMode, assemblyAI]);

  // Resume transcription
  const resume = useCallback(() => {
    if (currentMode === 'assemblyai') {
      assemblyAI.resumeStreaming();
    } else if (whisperRef.current) {
      whisperRef.current.resume();
    }
  }, [currentMode, assemblyAI]);

  // Switch transcription mode
  const switchMode = useCallback((newMode: 'whisper' | 'assemblyai') => {
    if (!isActive) {
      setCurrentMode(newMode);
      toast.info(`Switched to ${newMode === 'assemblyai' ? 'Real-time Streaming' : 'High Accuracy'} mode`);
    } else {
      toast.error('Cannot switch mode while transcription is active');
    }
  }, [isActive]);

  return {
    isActive,
    currentMode,
    stats,
    start,
    stop,
    pause,
    resume,
    switchMode,
    isStreaming: currentMode === 'assemblyai' && assemblyAI.isStreaming,
    isConnected: currentMode === 'assemblyai' && assemblyAI.isConnected,
  };
}
