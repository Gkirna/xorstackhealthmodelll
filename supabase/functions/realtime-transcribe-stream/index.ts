import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
  
  if (!DEEPGRAM_API_KEY) {
    console.error('DEEPGRAM_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Transcription service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { audio, session_id } = await req.json();

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'No audio data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎙️ Processing streaming audio for session: ${session_id}`);

    // Decode base64 audio to binary
    const binaryString = atob(audio);
    const audioBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i);
    }

    // Deepgram API with diarization and streaming features
    const deepgramUrl = 'https://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      diarize: 'true',
      punctuate: 'true',
      utterances: 'true',
      detect_language: 'false',
      language: 'en-US',
      interim_results: 'false',
      encoding: 'linear16',
      sample_rate: '48000',
      channels: '1',
    });

    console.log('🚀 Sending to Deepgram API...');

    const response = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/raw',
      },
      body: audioBytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Deepgram response received');

    // Extract transcript and speaker information
    const channel = result.results?.channels?.[0];
    const alternatives = channel?.alternatives?.[0];
    const transcript = alternatives?.transcript || '';
    const words = alternatives?.words || [];
    const utterances = result.results?.utterances || [];

    // Build segments with speaker information
    const segments = utterances.map((utterance: any) => ({
      speaker: `Speaker ${utterance.speaker}`,
      text: utterance.transcript,
      start: utterance.start,
      end: utterance.end,
      confidence: utterance.confidence,
    }));

    // Calculate confidence
    const avgConfidence = words.length > 0
      ? words.reduce((sum: number, w: any) => sum + (w.confidence || 0), 0) / words.length
      : 0;

    // Count unique speakers
    const speakerSet = new Set(utterances.map((u: any) => u.speaker));
    const speakerCount = speakerSet.size;

    console.log(`📝 Transcribed: "${transcript.substring(0, 100)}..." | Speakers: ${speakerCount} | Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcript,
        segments,
        confidence: avgConfidence,
        speaker_count: speakerCount,
        words,
      metadata: {
        model: 'nova-2',
        duration: channel?.duration || 0,
      }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Transcription error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});