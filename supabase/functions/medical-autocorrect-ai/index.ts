import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Medical terminology dictionary for quick corrections
const MEDICAL_CORRECTIONS: Record<string, string> = {
  'diabetes melitus': 'diabetes mellitus',
  'high blood pressure': 'hypertension',
  'heart attack': 'myocardial infarction',
  'sugar levels': 'blood glucose levels',
  'blood sugar': 'blood glucose',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, useAI = true } = await req.json();

    if (!text) {
      throw new Error('No text provided');
    }

    let correctedText = text;

    // Step 1: Apply dictionary corrections
    Object.entries(MEDICAL_CORRECTIONS).forEach(([wrong, correct]) => {
      const regex = new RegExp(wrong, 'gi');
      correctedText = correctedText.replace(regex, correct);
    });

    // Step 2: AI-powered correction if enabled
    if (useAI) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        console.warn('LOVABLE_API_KEY not configured, skipping AI correction');
        return new Response(
          JSON.stringify({ correctedText, success: true, method: 'dictionary-only' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a medical transcription auto-correction assistant. Fix medical terminology errors, drug names, anatomical terms, and abbreviations. Preserve original meaning. Return ONLY the corrected text, no explanations.

Common corrections:
- Medical terms: proper spelling and capitalization
- Drug names: correct capitalization (e.g., "metformin", "Lisinopril")
- Units: "mg", "ml", "mcg" (not spelled out)
- Vital signs: "BP", "HR", "RR", "SpO2", "Temp"
- Anatomical terms: correct medical terminology

If text is already correct, return it unchanged.`
            },
            {
              role: 'user',
              content: correctedText
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status === 402) {
          throw new Error('AI service requires payment. Please add credits.');
        }
        const errorText = await response.text();
        throw new Error(`AI service error: ${errorText}`);
      }

      const data = await response.json();
      const aiCorrected = data.choices?.[0]?.message?.content?.trim();

      if (aiCorrected) {
        correctedText = aiCorrected;
      }
    }

    console.log('✅ Auto-correction complete:', { 
      originalLength: text.length, 
      correctedLength: correctedText.length,
      method: useAI ? 'dictionary+ai' : 'dictionary-only'
    });

    return new Response(
      JSON.stringify({ 
        correctedText,
        success: true,
        method: useAI ? 'dictionary+ai' : 'dictionary-only'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Medical auto-correction error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Auto-correction failed',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
