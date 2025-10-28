export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface TranscriptionSegment {
  text: string;
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  words: TranscriptionWord[];
}

export interface MedicalEntity {
  text: string;
  type: 'medication' | 'diagnosis' | 'procedure' | 'symptom' | 'anatomy' | 'dosage' | 'vital_sign' | 'allergy';
  start: number;
  end: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface AdvancedTranscriptionResult {
  success: boolean;
  text: string;
  segments: TranscriptionSegment[];
  confidence: number;
  speaker_count: number;
  metadata: {
    model: string;
    duration: number;
    processing_time: number;
  };
}

export interface MedicalEntityExtractionResult {
  success: boolean;
  entities: MedicalEntity[];
  statistics: {
    total_entities: number;
    by_type: Record<string, number>;
    avg_confidence: number;
  };
}

export interface EnhancedTranscriptionData {
  transcript: string;
  segments: TranscriptionSegment[];
  entities: MedicalEntity[];
  confidence: number;
  speaker_count: number;
  statistics: {
    total_entities: number;
    by_type: Record<string, number>;
    avg_confidence: number;
  };
}
