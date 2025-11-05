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
    const { audio, session_id } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🎙️ Starting audio transcription...');

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Create form data with enhanced settings for global English accents
    const formData = new FormData();
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'kn'); // Kannada language
    formData.append('temperature', '0.0'); // Lower temperature for more accurate, deterministic transcriptions
    
    // Add medical context prompt in Kannada to improve accuracy for clinical terminology
    const medicalPrompt = 'ಇದು ಆರೋಗ್ಯ ಸೇವಾ ಪೂರೈಕೆದಾರ ಮತ್ತು ರೋಗಿಯ ನಡುವಿನ ವೈದ್ಯಕೀಯ ಸಮಾಲೋಚನೆಯಾಗಿದೆ. ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ ಪದಗಳು: ಔಷಧಿ, ರೋಗನಿರ್ಣಯ, ಲಕ್ಷಣಗಳು, ಚಿಕಿತ್ಸೆ, ಅಲರ್ಜಿ, ಪ್ರಮಾಣ, ರಕ್ತದೊತ್ತಡ, ಹೃದಯ ಬಡಿತ, ಮಧುಮೇಹ, ಅಧಿಕ ರಕ್ತದೊತ್ತಡ, ಪರೀಕ್ಷೆ.';
    formData.append('prompt', medicalPrompt);

    // Call OpenAI Whisper API through Lovable AI Gateway
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Transcription API error:', errorText);
      throw new Error(`Transcription failed: ${response.status}`);
    }

    const result = await response.json();
    const transcriptText = result.text;

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
