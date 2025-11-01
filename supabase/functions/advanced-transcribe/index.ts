import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssemblyAIWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

interface AssemblyAIUtterance {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: string;
  words: AssemblyAIWord[];
}

interface TranscriptionSegment {
  text: string;
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  words: {
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker: number;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, session_id } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    console.log('🎙️ Starting advanced transcription with AssemblyAI...');

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Step 1: Upload audio to AssemblyAI
    console.log('📤 Uploading audio to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream',
      },
      body: binaryAudio,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload error:', errorText);
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const { upload_url } = await uploadResponse.json();
    console.log('✅ Audio uploaded successfully');

    // Step 2: Submit transcription job with medical configuration
    console.log('🔄 Submitting transcription job with slam-1 medical model...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speech_model: 'slam-1',           // Medical-optimized model
        speaker_labels: true,              // Enable advanced speaker diarization
        speakers_expected: null,           // Auto-detect number of speakers (handles any gender combo)
        multichannel: false,
        disfluencies: false,               // Clean up "uh", "um", etc.
        format_text: true,                 // Auto-formatting
        punctuate: true,                   // Auto-punctuation
        language_code: 'en',               // English (handles all accents: US, UK, AU, IN, etc.)
        language_detection: true,          // Auto-detect English dialect
        speech_threshold: 0.3,             // Lower threshold to catch softer speech and accents
        auto_highlights: true,             // Highlight key medical terms
        entity_detection: true,            // Detect medical entities
        sentiment_analysis: false,         // Not needed for medical
        word_boost: [                      // Boost medical terminology across all accents
          'diabetes', 'hypertension', 'medication', 'prescription', 'mg', 'ml',
          'diagnosis', 'symptoms', 'treatment', 'allergy', 'tablet', 'capsule',
          'dosage', 'patient', 'doctor', 'blood pressure', 'heart rate', 'physician',
          'examination', 'assessment', 'chest pain', 'shortness of breath', 'fever',
          'nausea', 'vomiting', 'diarrhea', 'headache', 'dizziness', 'fatigue',
          'ibuprofen', 'paracetamol', 'amoxicillin', 'insulin', 'aspirin',
          'CT scan', 'MRI', 'X-ray', 'ultrasound', 'ECG', 'EKG', 'blood test'
        ],
        boost_param: 'high',               // High boost for medical terms
        filter_profanity: false,           // Keep all speech as-is
        redact_pii: false,                 // Don't redact patient info
        speaker_boost: true,               // Boost speaker separation accuracy
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('❌ Transcription submission error:', errorText);
      throw new Error(`Transcription submission failed: ${transcriptResponse.status}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log(`✅ Transcription job submitted: ${transcriptId}`);

    // Step 3: Poll for completion with exponential backoff
    console.log('⏳ Polling for transcription completion...');
    let transcript: any;
    let pollAttempts = 0;
    const maxPollAttempts = 300; // 5 minutes timeout
    let delay = 1000; // Start with 1 second

    while (pollAttempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 
          'authorization': ASSEMBLYAI_API_KEY 
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('❌ Status check error:', errorText);
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      transcript = await statusResponse.json();
      pollAttempts++;

      // Log progress every 10 polls
      if (pollAttempts % 10 === 0) {
        console.log(`⏳ Still processing... (attempt ${pollAttempts}/${maxPollAttempts})`);
      }

      if (transcript.status === 'completed') {
        console.log('✅ Transcription completed successfully');
        break;
      }
      
      if (transcript.status === 'error') {
        console.error('❌ Transcription failed:', transcript.error);
        throw new Error(`Transcription error: ${transcript.error}`);
      }

      // Exponential backoff: 1s → 2s → 3s → 5s → 5s (cap at 5s)
      delay = Math.min(delay + 1000, 5000);
    }

    if (pollAttempts >= maxPollAttempts) {
      throw new Error('Transcription timeout - audio may be too long');
    }

    // Check if transcript has any text
    if (!transcript.text || transcript.text.trim() === '') {
      console.warn('⚠️ No speech detected in audio');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NO_SPEECH_DETECTED',
            message: 'No speech detected in audio. Please try again.',
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 4: Format response to match expected schema
    const utterances: AssemblyAIUtterance[] = transcript.utterances || [];
    
    // Map speakers (A, B, C...) to numbers (0, 1, 2...)
    const speakerMap = new Map<string, number>();
    let speakerIndex = 0;
    
    const segments: TranscriptionSegment[] = utterances.map((utt) => {
      if (!speakerMap.has(utt.speaker)) {
        speakerMap.set(utt.speaker, speakerIndex++);
      }
      const speakerNum = speakerMap.get(utt.speaker)!;
      
      return {
        text: utt.text,
        speaker: speakerNum,
        start: utt.start / 1000, // Convert ms to seconds
        end: utt.end / 1000,     // Convert ms to seconds
        confidence: utt.confidence,
        words: utt.words.map((w) => ({
          word: w.text,
          start: w.start / 1000,
          end: w.end / 1000,
          confidence: w.confidence,
          speaker: speakerNum,
        })),
      };
    });

    // Calculate overall confidence
    const overallConfidence = transcript.confidence || 
      (segments.length > 0 ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length : 0);

    console.log(`✅ Transcription successful - ${segments.length} segments, confidence: ${(overallConfidence * 100).toFixed(1)}%`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcript.text,
        segments,
        confidence: overallConfidence,
        speaker_count: speakerMap.size,
        metadata: {
          model: 'slam-1',
          duration: transcript.audio_duration || 0,
          processing_time: pollAttempts * delay / 1000,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Advanced transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Determine appropriate error code
    let errorCode = 'TRANSCRIPTION_ERROR';
    let statusCode = 500;
    
    if (errorMessage.includes('not configured')) {
      errorCode = 'API_KEY_MISSING';
      statusCode = 403;
    } else if (errorMessage.includes('Upload failed: 400')) {
      errorCode = 'INVALID_AUDIO_FORMAT';
      statusCode = 400;
    } else if (errorMessage.includes('timeout')) {
      errorCode = 'PROCESSING_TIMEOUT';
      statusCode = 408;
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
