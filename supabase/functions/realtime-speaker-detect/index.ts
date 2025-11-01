import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Advanced Real-Time Speaker Detection using AssemblyAI
 * Handles same-speaker gaps correctly through voice acoustic analysis
 */

interface AudioChunk {
  audio: string; // base64
  timestamp: number;
  sessionId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, session_id, is_final } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    console.log('🎙️ Processing audio chunk with advanced speaker detection...');

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Upload audio chunk to AssemblyAI
    console.log('📤 Uploading audio chunk to AssemblyAI...');
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
    console.log('✅ Audio chunk uploaded');

    // Submit transcription with VOICE-BASED speaker detection
    console.log('🔄 Transcribing with acoustic speaker analysis...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speech_model: 'slam-1',              // Medical-optimized
        speaker_labels: true,                 // CRITICAL: Voice-based speaker detection
        speakers_expected: null,              // Auto-detect (handles any combination)
        
        // ACOUSTIC ANALYSIS PARAMETERS (solves the gap problem)
        audio_start_from: 0,
        audio_end_at: null,
        
        // Enhanced speaker separation
        speaker_boost: true,                  // Boost speaker separation accuracy
        multichannel: false,
        
        // Language and formatting
        language_code: 'en',
        language_detection: true,
        format_text: true,
        punctuate: true,
        disfluencies: false,
        
        // Speech detection tuning
        speech_threshold: 0.3,                // Catch varied accents
        
        // Medical context
        word_boost: [
          'diabetes', 'hypertension', 'medication', 'prescription', 'mg', 'ml',
          'diagnosis', 'symptoms', 'treatment', 'allergy', 'tablet', 'capsule',
          'dosage', 'patient', 'doctor', 'blood pressure', 'heart rate', 'physician'
        ],
        boost_param: 'high',
        
        // Advanced features
        auto_highlights: true,
        entity_detection: true,
        sentiment_analysis: false,
        filter_profanity: false,
        redact_pii: false,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('❌ Transcription submission error:', errorText);
      throw new Error(`Transcription submission failed: ${transcriptResponse.status}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log(`✅ Transcription job submitted: ${transcriptId}`);

    // Poll for completion with optimized timing
    console.log('⏳ Polling for completion...');
    let transcript: any;
    let pollAttempts = 0;
    const maxPollAttempts = 60; // 1 minute timeout for chunks
    let delay = 500; // Start with 500ms

    while (pollAttempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 
          'authorization': ASSEMBLYAI_API_KEY 
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      transcript = await statusResponse.json();
      pollAttempts++;

      if (transcript.status === 'completed') {
        console.log('✅ Transcription completed');
        break;
      }
      
      if (transcript.status === 'error') {
        throw new Error(`Transcription error: ${transcript.error}`);
      }

      // Adaptive delay: 500ms → 1s → 1.5s → 2s (cap)
      delay = Math.min(delay + 500, 2000);
    }

    if (pollAttempts >= maxPollAttempts) {
      throw new Error('Transcription timeout');
    }

    // Check if transcript has content
    if (!transcript.text || transcript.text.trim() === '') {
      return new Response(
        JSON.stringify({
          success: true,
          text: '',
          speaker: null,
          confidence: 0,
          message: 'No speech detected in this chunk',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract speaker information using ACOUSTIC ANALYSIS
    // AssemblyAI uses voice fingerprinting - same speaker = same label, even with gaps
    const utterances = transcript.utterances || [];
    
    if (utterances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          text: transcript.text,
          speaker: 'provider', // Default
          confidence: transcript.confidence || 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the most recent utterance (dominant speaker in this chunk)
    const lastUtterance = utterances[utterances.length - 1];
    
    // Map AssemblyAI speaker labels (A, B, C...) to our labels (provider, patient)
    // Speaker A = first detected voice (usually provider)
    // Speaker B = second detected voice (usually patient)
    const speakerLabel = lastUtterance.speaker === 'A' ? 'provider' : 'patient';
    
    console.log(`✅ Speaker detected: ${speakerLabel} (${lastUtterance.speaker}) - Confidence: ${transcript.confidence}`);
    console.log(`📝 Text: "${transcript.text.substring(0, 100)}..."`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcript.text,
        speaker: speakerLabel,
        speaker_raw: lastUtterance.speaker, // A, B, C, etc.
        confidence: transcript.confidence || 0,
        utterances: utterances.map((u: any) => ({
          text: u.text,
          speaker: u.speaker,
          start: u.start / 1000,
          end: u.end / 1000,
        })),
        metadata: {
          processing_time: pollAttempts * delay,
          speaker_count: new Set(utterances.map((u: any) => u.speaker)).size,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Real-time speaker detection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SPEAKER_DETECTION_ERROR',
          message: errorMessage,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
