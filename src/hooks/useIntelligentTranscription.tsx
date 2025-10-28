/**
 * Hook for Intelligent Transcription Pipeline
 * Integrates Deepgram + GPT for complete medical transcription workflow
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { IntelligentTranscriptionPipeline, StructuredOutput, SpeakerSegment } from '@/services/IntelligentTranscriptionPipeline';
import { AudioProcessor } from '@/services/AudioProcessor';

interface IntelligentTranscriptionConfig {
  enableDiarization?: boolean;
  enableRoleAssignment?: boolean;
  enableGenderInference?: boolean;
  enableMedicalNER?: boolean;
  enableSentimentAnalysis?: boolean;
  enableUrgencyDetection?: boolean;
}

interface RealTimeStatus {
  isActive: boolean;
  speakersDetected: number;
  segmentsProcessed: number;
  currentSpeaker?: string;
  lastSegment?: SpeakerSegment;
}

export function useIntelligentTranscription(
  sessionId: string,
  config: IntelligentTranscriptionConfig = {
    enableDiarization: true,
    enableRoleAssignment: true,
    enableGenderInference: true,
    enableMedicalNER: true,
    enableSentimentAnalysis: true,
    enableUrgencyDetection: true
  }
) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<RealTimeStatus>({
    isActive: false,
    speakersDetected: 0,
    segmentsProcessed: 0
  });
  const [structuredOutput, setStructuredOutput] = useState<StructuredOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const pipelineRef = useRef<IntelligentTranscriptionPipeline | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize intelligent pipeline
        pipelineRef.current = new IntelligentTranscriptionPipeline(sessionId);
        
        // Initialize audio processor
        audioProcessorRef.current = new AudioProcessor({
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          chunkSize: 4096
        });
        
        await audioProcessorRef.current.initialize();
        
        console.log('✅ Intelligent transcription services initialized');
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        toast.error('Failed to initialize intelligent transcription');
      }
    };

    initializeServices();

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.destroy();
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.destroy();
      }
    };
  }, [sessionId]);

  // Start intelligent transcription
  const startTranscription = useCallback(async (): Promise<boolean> => {
    if (!pipelineRef.current || !audioProcessorRef.current) {
      console.error('Services not initialized');
      return false;
    }

    try {
      console.log('🚀 Starting intelligent transcription pipeline...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      streamRef.current = stream;

      // Start pipeline
      const pipelineStarted = await pipelineRef.current.startPipeline();
      if (!pipelineStarted) {
        console.error('Failed to start pipeline');
        return false;
      }

      // Start audio processing
      const audioStarted = await audioProcessorRef.current.startProcessing(
        stream,
        (audioData) => {
          // Send audio data to Deepgram
          if (pipelineRef.current) {
            pipelineRef.current.sendAudio(audioData);
          }
        }
      );

      if (!audioStarted) {
        console.error('Failed to start audio processing');
        return false;
      }

      setIsActive(true);
      setStatus(prev => ({ ...prev, isActive: true }));

      // Start status monitoring
      const statusInterval = setInterval(() => {
        if (pipelineRef.current) {
          const pipelineStatus = pipelineRef.current.getStatus();
          setStatus({
            isActive: true,
            speakersDetected: pipelineStatus.speakersDetected,
            segmentsProcessed: pipelineStatus.segmentsProcessed,
            currentSpeaker: pipelineStatus.lastSegment?.speakerId,
            lastSegment: pipelineStatus.lastSegment
          });
        }
      }, 2000);

      // Store interval for cleanup
      (pipelineRef.current as any).statusInterval = statusInterval;

      toast.success('Intelligent transcription started');
      console.log('✅ Intelligent transcription pipeline active');

      return true;
    } catch (error) {
      console.error('❌ Failed to start intelligent transcription:', error);
      toast.error('Failed to start intelligent transcription');
      return false;
    }
  }, []);

  // Stop transcription and get structured output
  const stopTranscription = useCallback(async (): Promise<StructuredOutput | null> => {
    if (!pipelineRef.current || !isActive) {
      return null;
    }

    try {
      setIsProcessing(true);
      console.log('🛑 Stopping intelligent transcription pipeline...');

      // Stop audio processing
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stopProcessing();
      }

      // Stop microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Stop pipeline and get structured output
      const output = await pipelineRef.current.stopPipeline();
      
      setStructuredOutput(output);
      setIsActive(false);
      setIsProcessing(false);

      // Clear status interval
      if ((pipelineRef.current as any).statusInterval) {
        clearInterval((pipelineRef.current as any).statusInterval);
      }

      setStatus(prev => ({ ...prev, isActive: false }));

      console.log('✅ Intelligent transcription completed:', {
        speakers: output.speakers.length,
        duration: output.summary.totalDuration,
        entities: output.summary.medicalEntitiesFound
      });

      toast.success('Intelligent transcription completed');
      return output;
    } catch (error) {
      console.error('❌ Error stopping intelligent transcription:', error);
      toast.error('Failed to complete intelligent transcription');
      setIsProcessing(false);
      return null;
    }
  }, [isActive]);

  // Pause transcription
  const pauseTranscription = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stopProcessing();
    }
    setIsActive(false);
    setStatus(prev => ({ ...prev, isActive: false }));
    toast.info('Transcription paused');
  }, []);

  // Resume transcription
  const resumeTranscription = useCallback(async () => {
    if (!streamRef.current || !audioProcessorRef.current) return;

    try {
      const audioStarted = await audioProcessorRef.current.startProcessing(
        streamRef.current,
        (audioData) => {
          if (pipelineRef.current) {
            pipelineRef.current.sendAudio(audioData);
          }
        }
      );

      if (audioStarted) {
        setIsActive(true);
        setStatus(prev => ({ ...prev, isActive: true }));
        toast.success('Transcription resumed');
      }
    } catch (error) {
      console.error('❌ Failed to resume transcription:', error);
      toast.error('Failed to resume transcription');
    }
  }, []);

  // Get real-time transcript preview
  const getTranscriptPreview = useCallback(() => {
    if (!structuredOutput) return '';

    return structuredOutput.speakers
      .map(speaker => {
        const roleLabel = speaker.role === 'doctor' ? 'Doctor' : 
                        speaker.role === 'patient' ? 'Patient' : 'Speaker';
        const genderIcon = speaker.gender === 'male' ? '👨' : 
                          speaker.gender === 'female' ? '👩' : '👤';
        
        return speaker.segments
          .map(segment => `**${roleLabel}** ${genderIcon} ${segment.cleanedText}`)
          .join('\n');
      })
      .join('\n\n');
  }, [structuredOutput]);

  // Get medical entities summary
  const getMedicalEntitiesSummary = useCallback(() => {
    if (!structuredOutput) return [];

    const allEntities = structuredOutput.speakers
      .flatMap(speaker => speaker.segments.flatMap(segment => segment.analysis.medicalEntities));

    // Group by category
    const grouped = allEntities.reduce((acc, entity) => {
      if (!acc[entity.category]) {
        acc[entity.category] = [];
      }
      acc[entity.category].push(entity);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }, [structuredOutput]);

  // Get conversation summary
  const getConversationSummary = useCallback(() => {
    if (!structuredOutput) return null;

    return {
      duration: structuredOutput.summary.totalDuration,
      speakers: structuredOutput.summary.speakerCount,
      entities: structuredOutput.summary.medicalEntitiesFound,
      sentiment: structuredOutput.summary.overallSentiment,
      urgency: structuredOutput.summary.urgencyLevel,
      doctorSegments: structuredOutput.speakers
        .filter(s => s.role === 'doctor')
        .flatMap(s => s.segments).length,
      patientSegments: structuredOutput.speakers
        .filter(s => s.role === 'patient')
        .flatMap(s => s.segments).length
    };
  }, [structuredOutput]);

  return {
    // State
    isActive,
    isProcessing,
    status,
    structuredOutput,
    
    // Actions
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    
    // Data access
    getTranscriptPreview,
    getMedicalEntitiesSummary,
    getConversationSummary,
    
    // Configuration
    config
  };
}
