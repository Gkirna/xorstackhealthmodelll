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
    try {
      console.log('🎙️ Calling advanced transcription...');

      const { data, error } = await supabase.functions.invoke('advanced-transcribe', {
        body: { audio: audioBase64 }
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error('Transcription failed: ' + error.message);
        return null;
      }

      if (!data.success) {
        console.error('Transcription unsuccessful:', data.error);
        
        // Handle specific error codes
        if (data.error?.code === 'NO_SPEECH_DETECTED') {
          toast.error('No speech detected in the audio recording');
        } else {
          toast.error('Transcription failed: ' + data.error?.message);
        }
        return null;
      }

      // Additional validation
      if (!data.text || data.text.trim().length === 0) {
        console.error('Transcription returned empty text');
        toast.error('No speech detected in the audio');
        return null;
      }

      console.log(`✅ Transcription complete: ${data.segments.length} segments, ${data.speaker_count} speakers, confidence: ${(data.confidence * 100).toFixed(1)}%`);

      return data as AdvancedTranscriptionResult;
    } catch (error) {
      console.error('Transcription exception:', error);
      toast.error('Transcription error: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        console.error('Empty text provided for entity extraction');
        toast.error('Cannot extract entities from empty text');
        return null;
      }

      console.log('🏥 Extracting medical entities from', text.length, 'characters...');

      const { data, error } = await supabase.functions.invoke('extract-medical-entities', {
        body: { text, segments }
      });

      if (error) {
        console.error('Entity extraction error:', error);
        toast.error('Entity extraction failed: ' + error.message);
        return null;
      }

      if (!data.success) {
        console.error('Entity extraction unsuccessful:', data.error);
        toast.error('Entity extraction failed: ' + data.error?.message);
        return null;
      }

      console.log(`✅ Extracted ${data.entities.length} medical entities`);

      return data as MedicalEntityExtractionResult;
    } catch (error) {
      console.error('Entity extraction exception:', error);
      toast.error('Entity extraction error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return null;
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
        console.error('Transcription failed, skipping entity extraction');
        return null;
      }

      // Validate transcription has text
      if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
        console.error('Transcription returned empty text, skipping entity extraction');
        toast.error('Transcription produced no text');
        return null;
      }

      console.log('📝 Transcription text length:', transcriptionResult.text.length);

      // Step 2: Extract medical entities
      const entityResult = await extractMedicalEntities(
        transcriptionResult.text,
        transcriptionResult.segments
      );
      if (!entityResult) {
        // Return transcription only if entity extraction fails
        console.warn('Entity extraction failed, returning transcription only');
        return {
          transcript: transcriptionResult.text,
          segments: transcriptionResult.segments,
          entities: [],
          confidence: transcriptionResult.confidence,
          speaker_count: transcriptionResult.speaker_count,
          statistics: {
            total_entities: 0,
            by_type: {},
            avg_confidence: 0
          }
        };
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
