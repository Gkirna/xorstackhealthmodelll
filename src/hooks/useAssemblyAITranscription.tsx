import { useState, useCallback, useRef, useEffect } from 'react';
import { AssemblyAITranscription } from '@/utils/AssemblyAITranscription';
import { toast } from 'sonner';

interface UseAssemblyAITranscriptionProps {
  onTranscriptChunk?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useAssemblyAITranscription({
  onTranscriptChunk,
  onError,
}: UseAssemblyAITranscriptionProps = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [fullTranscript, setFullTranscript] = useState('');
  const transcriptionRef = useRef<AssemblyAITranscription | null>(null);
  const currentPartialRef = useRef<string>('');

  // Initialize transcription instance
  useEffect(() => {
    transcriptionRef.current = new AssemblyAITranscription({
      onTranscript: (text: string, isFinal: boolean) => {
        console.log(`📝 Transcript ${isFinal ? 'FINAL' : 'partial'}:`, text);
        
        if (isFinal) {
          // Add to full transcript
          setFullTranscript(prev => {
            const newTranscript = prev + (prev ? ' ' : '') + text;
            return newTranscript;
          });
          
          // Clear current partial
          currentPartialRef.current = '';
          
          // Notify parent
          onTranscriptChunk?.(text, true);
        } else {
          // Update current partial
          currentPartialRef.current = text;
          
          // Notify parent for UI updates
          onTranscriptChunk?.(text, false);
        }
      },
      onError: (error: string) => {
        console.error('❌ Transcription error:', error);
        toast.error(error);
        onError?.(error);
      },
      onConnectionChange: (connected: boolean) => {
        console.log(`🔌 Connection ${connected ? 'established' : 'lost'}`);
        setIsConnected(connected);
        
        if (connected) {
          toast.success('Connected to transcription service');
        } else if (isTranscribing) {
          toast.error('Connection lost');
        }
      },
    });

    return () => {
      if (transcriptionRef.current) {
        transcriptionRef.current.stop();
      }
    };
  }, [onTranscriptChunk, onError, isTranscribing]);

  /**
   * Start real-time transcription
   */
  const startTranscription = useCallback(async () => {
    if (!transcriptionRef.current) {
      toast.error('Transcription service not initialized');
      return false;
    }

    if (isTranscribing) {
      console.warn('Transcription already in progress');
      return false;
    }

    try {
      console.log('▶️ Starting AssemblyAI transcription...');
      setIsTranscribing(true);
      setFullTranscript('');
      currentPartialRef.current = '';
      
      const success = await transcriptionRef.current.start();
      
      if (!success) {
        setIsTranscribing(false);
        toast.error('Failed to start transcription');
        return false;
      }

      toast.success('Transcription started');
      return true;
    } catch (error) {
      console.error('Error starting transcription:', error);
      setIsTranscribing(false);
      toast.error('Failed to start transcription');
      return false;
    }
  }, [isTranscribing]);

  /**
   * Stop transcription
   */
  const stopTranscription = useCallback(() => {
    if (!transcriptionRef.current || !isTranscribing) {
      return;
    }

    console.log('⏹️ Stopping transcription...');
    transcriptionRef.current.stop();
    setIsTranscribing(false);
    setIsConnected(false);
    
    toast.success('Transcription stopped');
  }, [isTranscribing]);

  /**
   * Get the current full transcript
   */
  const getFullTranscript = useCallback(() => {
    return fullTranscript;
  }, [fullTranscript]);

  /**
   * Get current partial transcript
   */
  const getCurrentPartial = useCallback(() => {
    return currentPartialRef.current;
  }, []);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setFullTranscript('');
    currentPartialRef.current = '';
  }, []);

  return {
    isTranscribing,
    isConnected,
    fullTranscript,
    startTranscription,
    stopTranscription,
    getFullTranscript,
    getCurrentPartial,
    clearTranscript,
  };
}
