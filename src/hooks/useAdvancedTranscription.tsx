import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  AdvancedTranscriptionResult,
  MedicalEntityExtractionResult,
  EnhancedTranscriptionData,
} from '@/types/advancedTranscription';

export const useAdvancedTranscription = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExtractingEntities, setIsExtractingEntities] = useState(false);

  const transcribeAudio = useCallback(async (audioBase64: string): Promise<AdvancedTranscriptionResult | null> => {
    setIsTranscribing(true);
    
    // Show progress toast
    const toastId = toast.loading('Processing audio with medical AI...');
    
    try {
      console.log('🎙️ Calling advanced transcription with AssemblyAI...');

      const { data, error } = await supabase.functions.invoke('advanced-transcribe', {
        body: { audio: audioBase64 }
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error('Transcription failed: ' + error.message, { id: toastId });
        return null;
      }

      // Handle specific error codes
      if (!data.success) {
        const errorCode = data.error?.code || 'UNKNOWN_ERROR';
        const errorMessage = data.error?.message || 'Transcription failed';

        console.error('Transcription unsuccessful:', errorCode, errorMessage);

        if (errorCode === 'NO_SPEECH_DETECTED') {
          toast.error('No speech detected in audio. Please try again.', { id: toastId });
        } else if (errorCode === 'API_KEY_MISSING') {
          toast.error('API configuration error. Please contact support.', { id: toastId });
        } else if (errorCode === 'INVALID_AUDIO_FORMAT') {
          toast.error('Invalid audio format. Please use mp3, wav, or m4a.', { id: toastId });
        } else if (errorCode === 'PROCESSING_TIMEOUT') {
          toast.error('Processing took too long. Audio may be too large.', { id: toastId });
        } else {
          toast.error(errorMessage, { id: toastId });
        }
        
        return null;
      }

      // Validate transcript text
      if (!data.text || data.text.trim() === '') {
        console.warn('⚠️ Empty transcript received');
        toast.error('No speech detected in audio.', { id: toastId });
        return null;
      }

      console.log(`✅ Transcription complete: ${data.segments.length} segments, ${data.speaker_count} speakers, confidence: ${(data.confidence * 100).toFixed(1)}%`);
      toast.success(`Transcribed with ${(data.confidence * 100).toFixed(0)}% confidence`, { id: toastId });

      return data as AdvancedTranscriptionResult;
    } catch (error) {
      console.error('Transcription exception:', error);
      toast.error('Transcription error: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: toastId });
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const extractMedicalEntities = useCallback(async (
    text: string,
    segments?: any[]
  ): Promise<MedicalEntityExtractionResult | null> => {
    setIsExtractingEntities(true);
    
    const toastId = toast.loading('Analyzing medical entities...');
    
    try {
      console.log('🏥 Extracting medical entities...');

      const { data, error } = await supabase.functions.invoke('extract-medical-entities', {
        body: { text, segments }
      });

      if (error) {
        console.error('Entity extraction error:', error);
        toast.error('Entity extraction failed: ' + error.message, { id: toastId });
        return null;
      }

      if (!data.success) {
        console.error('Entity extraction unsuccessful:', data.error);
        // Don't show error toast - just log it (entity extraction is optional)
        console.warn('Entity extraction returned no results, continuing without entities');
        toast.dismiss(toastId);
        return {
          success: true,
          entities: [],
          statistics: {
            total_entities: 0,
            by_type: {},
            avg_confidence: 0,
          },
        };
      }

      console.log(`✅ Extracted ${data.entities.length} medical entities`);
      toast.success(`Found ${data.entities.length} medical entities`, { id: toastId });

      return data as MedicalEntityExtractionResult;
    } catch (error) {
      console.error('Entity extraction exception:', error);
      // Don't fail the entire process if entity extraction fails
      toast.dismiss(toastId);
      return {
        success: true,
        entities: [],
        statistics: {
          total_entities: 0,
          by_type: {},
          avg_confidence: 0,
        },
      };
    } finally {
      setIsExtractingEntities(false);
    }
  }, []);

  const processAudioWithFullAnalysis = useCallback(async (
    audioBase64: string
  ): Promise<EnhancedTranscriptionData | null> => {
    try {
      // Step 1: Transcribe with speaker diarization
      const transcriptionResult = await transcribeAudio(audioBase64);
      if (!transcriptionResult) {
        return null;
      }

      // Step 2: Extract medical entities
      const entityResult = await extractMedicalEntities(
        transcriptionResult.text,
        transcriptionResult.segments
      );
      if (!entityResult) {
        return null;
      }

      // Combine results
      const enhancedData: EnhancedTranscriptionData = {
        transcript: transcriptionResult.text,
        segments: transcriptionResult.segments,
        entities: entityResult.entities,
        confidence: transcriptionResult.confidence,
        speaker_count: transcriptionResult.speaker_count,
        statistics: entityResult.statistics,
      };

      toast.success(
        `Transcription complete: ${enhancedData.speaker_count} speakers, ${enhancedData.entities.length} medical entities identified`,
        { duration: 5000 }
      );

      return enhancedData;
    } catch (error) {
      console.error('Full analysis error:', error);
      toast.error('Analysis failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return null;
    }
  }, [transcribeAudio, extractMedicalEntities]);

  return {
    transcribeAudio,
    extractMedicalEntities,
    processAudioWithFullAnalysis,
    isTranscribing,
    isExtractingEntities,
    isProcessing: isTranscribing || isExtractingEntities,
  };
};
