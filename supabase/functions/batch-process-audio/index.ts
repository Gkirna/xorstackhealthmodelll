import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { audio_url, session_id, model = 'whisper-1' } = await req.json();

    if (!audio_url || !session_id) {
      throw new Error('audio_url and session_id are required');
    }

    console.log('🎵 Batch processing audio:', { session_id, model, audio_url });

    // Fetch audio file
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio file');
    }

    const audioBlob = await audioResponse.blob();

    // Transcribe with OpenAI Whisper
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcription = await transcribeResponse.json();

    // Save transcripts to database
    const segments = transcription.segments || [];
    const transcripts = segments.map((segment: any) => ({
      session_id,
      speaker: 'Unknown', // Will need speaker diarization for proper attribution
      text: segment.text,
      timestamp_offset: Math.floor(segment.start * 1000),
      confidence_score: 0.95,
      is_corrected: false,
    }));

    if (transcripts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('session_transcripts')
        .insert(transcripts);

      if (insertError) throw insertError;
    }

    // Update session status
    await supabaseClient
      .from('sessions')
      .update({
        status: 'completed',
        transcription_duration_seconds: Math.floor(transcription.duration),
        total_words: transcription.text.split(' ').length,
      })
      .eq('id', session_id);

    console.log('✅ Batch processing complete:', {
      session_id,
      segments: segments.length,
      duration: transcription.duration,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        transcription: {
          text: transcription.text,
          duration: transcription.duration,
          segments: segments.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Batch processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Batch processing failed',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
