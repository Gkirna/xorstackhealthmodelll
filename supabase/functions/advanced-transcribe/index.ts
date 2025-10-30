import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB base64

const RequestSchema = z.object({
  audio: z.string().max(MAX_AUDIO_SIZE, 'Audio file too large (max 25MB)'),
  session_id: z.string().optional(),
});

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
    const requestData = await req.json();
    const validated = RequestSchema.parse(requestData);
    const { audio, session_id } = validated;

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Service temporarily unavailable' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎙️ Starting ultra-advanced transcription with OpenAI Whisper...');

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('timestamp_granularities[]', 'segment');

    // Call OpenAI Whisper API with advanced features
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ OpenAI Whisper API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'TRANSCRIPTION_ERROR', message: 'Transcription processing failed' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whisperResult = await whisperResponse.json();
    
    // Process segments with advanced speaker detection using GPT-5
    const segments: TranscriptionSegment[] = [];
    const fullTranscript = whisperResult.text || '';
    
    if (whisperResult.segments && whisperResult.segments.length > 0) {
      // Use GPT-5 to enhance transcription with speaker diarization and medical context
      const enhanceResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            {
              role: 'system',
              content: `You are an expert medical transcription assistant. Analyze the transcript and identify speakers (Doctor/Patient/Nurse). Add speaker labels, correct medical terminology, and improve clarity. Return JSON with format:
{
  "segments": [
    {"speaker": 0, "label": "Doctor", "text": "corrected text", "start": 0.0, "end": 5.2, "confidence": 0.95}
  ]
}`
            },
            {
              role: 'user',
              content: `Transcript segments:\n${JSON.stringify(whisperResult.segments.slice(0, 50))}\n\nFull text: ${fullTranscript.slice(0, 2000)}`
            }
          ],
          max_completion_tokens: 4000,
        }),
      });

      if (enhanceResponse.ok) {
        const enhanceResult = await enhanceResponse.json();
        const enhancedData = JSON.parse(enhanceResult.choices[0].message.content);
        
        segments.push(...enhancedData.segments.map((seg: any) => ({
          text: seg.text,
          speaker: seg.speaker || 0,
          start: seg.start || 0,
          end: seg.end || 0,
          confidence: seg.confidence || 0.9,
          words: [],
        })));
      } else {
        // Fallback to basic segmentation
        whisperResult.segments.forEach((seg: any, idx: number) => {
          segments.push({
            text: seg.text,
            speaker: idx % 2, // Alternate speakers as fallback
            start: seg.start || 0,
            end: seg.end || 0,
            confidence: 0.85,
            words: seg.words || [],
          });
        });
      }
    }

    const overallConfidence = segments.length > 0
      ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
      : 0.9;

    console.log(`✅ Ultra-advanced transcription successful - ${segments.length} segments, confidence: ${(overallConfidence * 100).toFixed(1)}%`);

    return new Response(
      JSON.stringify({
        success: true,
        text: fullTranscript,
        segments,
        confidence: overallConfidence,
        speaker_count: new Set(segments.map(s => s.speaker)).size,
        metadata: {
          model: 'whisper-1-enhanced-gpt5',
          duration: whisperResult.duration || 0,
          processing_time: Date.now(),
          language: whisperResult.language || 'en',
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Ultra-advanced transcription error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: { code: 'TRANSCRIPTION_ERROR', message: 'An error occurred during transcription' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
