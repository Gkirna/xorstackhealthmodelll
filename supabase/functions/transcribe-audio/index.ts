import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, session_id, language = 'en' } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    // Get AssemblyAI API key
    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    console.log('🎙️ Starting AssemblyAI transcription...', { language });

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Step 1: Upload audio to AssemblyAI
    console.log('📤 Uploading audio to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
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

    // Step 2: Request transcription
    console.log('🎯 Requesting transcription...');
    const languageCode = language === 'hi' ? 'hi' : language === 'kn' ? 'kn' : 'en';
    
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: languageCode,
        speaker_labels: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('❌ Transcription request error:', errorText);
      throw new Error(`Transcription request failed: ${transcriptResponse.status}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log('⏳ Polling for transcription results...', transcriptId);

    // Step 3: Poll for results (with timeout)
    let transcriptResult;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait
    
    while (attempts < maxAttempts) {
      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
        },
      });

      if (!pollingResponse.ok) {
        throw new Error(`Polling failed: ${pollingResponse.status}`);
      }

      transcriptResult = await pollingResponse.json();
      
      if (transcriptResult.status === 'completed') {
        console.log('✅ Transcription completed!');
        break;
      } else if (transcriptResult.status === 'error') {
        console.error('❌ Transcription error:', transcriptResult.error);
        throw new Error(`Transcription error: ${transcriptResult.error}`);
      }
      
      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Transcription timeout - took too long');
    }

    const transcriptText = transcriptResult.text;

    console.log('✅ Transcription successful, length:', transcriptText.length);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcriptText,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Transcribe-audio function error:', error);
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
