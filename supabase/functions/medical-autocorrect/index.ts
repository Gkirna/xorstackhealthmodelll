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
    const { text } = await req.json();

    if (!text) {
      throw new Error('No text provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🔧 Medical auto-correction requested:', { length: text.length });

    // Call Lovable AI for medical term correction
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
            content: `You are a medical transcription auto-correction assistant. Your job is to:
1. Fix common medical terminology errors (e.g., "diabetes mellitus" not "diabetes melitis")
2. Correct drug names to proper capitalization and spelling
3. Fix anatomical terms and medical abbreviations
4. Preserve the original meaning and context
5. Do NOT add new information
6. Return ONLY the corrected text, no explanations

Common corrections:
- "diabetes melitis" → "diabetes mellitus"
- "high blood pressure" → "hypertension"
- "heart attack" → "myocardial infarction"
- "sugar levels" → "blood glucose levels"
- Drug names: proper capitalization (e.g., "metformin", "Lisinopril")
- Units: "mg", "ml", "mcg" (not "milligrams", "milliliters")
- Vital signs: "BP", "HR", "RR", "SpO2", "Temp"

If the text is already correct, return it unchanged.`
          },
          {
            role: 'user',
            content: `Correct this medical transcription:\n\n${text}`
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
    const correctedText = data.choices?.[0]?.message?.content?.trim();

    if (!correctedText) {
      throw new Error('No correction returned from AI');
    }

    console.log('✅ Auto-correction complete:', { 
      originalLength: text.length, 
      correctedLength: correctedText.length 
    });

    return new Response(
      JSON.stringify({ 
        correctedText,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
