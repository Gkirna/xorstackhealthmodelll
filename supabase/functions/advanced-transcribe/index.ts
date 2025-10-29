import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

interface DeepgramUtterance {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number;
  words: DeepgramWord[];
}

interface TranscriptionSegment {
  text: string;
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  words: DeepgramWord[];
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

    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    console.log('🎙️ Starting advanced transcription with Deepgram...');

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Call Deepgram API with advanced features
    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: binaryAudio,
      // Advanced Deepgram features
      // @ts-ignore - URL params
      ...{
        searchParams: {
          model: 'nova-2-medical',          // Medical-specific model
          punctuate: 'true',                 // Auto-punctuation
          diarize: 'true',                   // Speaker diarization
          utterances: 'true',                // Group by speaker utterances
          smart_format: 'true',              // Smart formatting
          filler_words: 'true',              // Detect filler words
          language: 'en-US',
          tier: 'enhanced',                  // Enhanced accuracy
        }
      }
    });

    // Build URL with search params
    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2-medical');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('diarize', 'true');
    url.searchParams.set('utterances', 'true');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('filler_words', 'true');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('tier', 'enhanced');

    const dgResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: binaryAudio,
    });

    if (!dgResponse.ok) {
      const errorText = await dgResponse.text();
      console.error('❌ Deepgram API error:', errorText);
      throw new Error(`Transcription failed: ${dgResponse.status}`);
    }

    const result = await dgResponse.json();
    
    // Extract utterances with speaker diarization
    const utterances = result.results?.utterances || [];
    const segments: TranscriptionSegment[] = utterances.map((utt: DeepgramUtterance) => ({
      text: utt.text,
      speaker: utt.speaker,
      start: utt.start,
      end: utt.end,
      confidence: utt.confidence,
      words: utt.words,
    }));

    // Calculate overall confidence
    const overallConfidence = segments.length > 0
      ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
      : 0;

    // Get full transcript
    const fullTranscript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    console.log(`✅ Transcription successful - ${segments.length} segments, confidence: ${(overallConfidence * 100).toFixed(1)}%`);

    return new Response(
      JSON.stringify({
        success: true,
        text: fullTranscript,
        segments,
        confidence: overallConfidence,
        speaker_count: new Set(segments.map(s => s.speaker)).size,
        metadata: {
          model: 'nova-2-medical',
          duration: result.metadata?.duration || 0,
          processing_time: result.metadata?.duration || 0,
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
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'TRANSCRIPTION_ERROR',
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
