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

    console.log('🎙️ Starting fast audio transcription...', { language });

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    
    // Set language based on input (en, hi, kn)
    formData.append('language', language === 'hi' ? 'hi' : language === 'kn' ? 'kn' : 'en');
    formData.append('temperature', '0.0');
    
    // Add medical context prompts based on language
    const medicalPrompts: Record<string, string> = {
      'en': 'This is a medical consultation between a healthcare provider and a patient. Common medical terms: medication, diagnosis, symptoms, treatment, allergy, dosage, blood pressure, heart rate, diabetes, hypertension, examination.',
      'hi': 'यह एक स्वास्थ्य सेवा प्रदाता और रोगी के बीच चिकित्सा परामर्श है। सामान्य चिकित्सा शब्द: दवा, निदान, लक्षण, उपचार, एलर्जी, खुराक, रक्तचाप, हृदय गति, मधुमेह, उच्च रक्तचाप, परीक्षण।',
      'kn': 'ಇದು ಆರೋಗ್ಯ ಸೇವಾ ಪೂರೈಕೆದಾರ ಮತ್ತು ರೋಗಿಯ ನಡುವಿನ ವೈದ್ಯಕೀಯ ಸಮಾಲೋಚನೆಯಾಗಿದೆ. ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ ಪದಗಳು: ಔಷಧಿ, ರೋಗನಿರ್ಣಯ, ಲಕ್ಷಣಗಳು, ಚಿಕಿತ್ಸೆ, ಅಲರ್ಜಿ, ಪ್ರಮಾಣ, ರಕ್ತದೊತ್ತಡ, ಹೃದಯ ಬಡಿತ, ಮಧುಮೇಹ, ಅಧಿಕ ರಕ್ತದೊತ್ತಡ, ಪರೀಕ್ಷೆ.'
    };
    formData.append('prompt', medicalPrompts[language] || medicalPrompts['en']);

    // Call OpenAI Whisper API through Lovable AI Gateway
    // Note: Don't set Content-Type header - let fetch set it with proper boundary
    const response = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
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
