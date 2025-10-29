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
    const { transcript, analysis_type = 'full' } = await req.json();

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🧠 Starting GPT-5 medical analysis...', { analysis_type });

    let systemPrompt = '';
    let userPrompt = '';

    switch (analysis_type) {
      case 'soap_note':
        systemPrompt = `You are an expert medical scribe with deep knowledge of clinical documentation. Generate a comprehensive SOAP note from the conversation.`;
        userPrompt = `Generate a detailed SOAP note from this medical conversation:\n\n${transcript}\n\nReturn a structured JSON with: subjective, objective, assessment, plan, medications, allergies, vital_signs, chief_complaint, hpi, ros, physical_exam, differential_diagnosis, icd10_codes (with descriptions), follow_up.`;
        break;

      case 'entities':
        systemPrompt = `You are a medical NLP expert. Extract all medical entities with high precision.`;
        userPrompt = `Extract medical entities from this transcript:\n\n${transcript}\n\nReturn JSON with: symptoms (array), diagnoses (array), medications (array with dosage/frequency), procedures (array), anatomical_sites (array), labs (array with values), allergies (array), family_history (array), social_history (object).`;
        break;

      case 'summary':
        systemPrompt = `You are a clinical documentation specialist. Create concise, accurate summaries.`;
        userPrompt = `Create a clinical summary of this encounter:\n\n${transcript}\n\nInclude: chief complaint, key findings, diagnosis, treatment plan, follow-up. Keep it under 200 words but comprehensive.`;
        break;

      default: // 'full'
        systemPrompt = `You are an advanced medical AI performing comprehensive clinical analysis. Be thorough, accurate, and clinically relevant.`;
        userPrompt = `Perform a complete medical analysis of this conversation:\n\n${transcript}\n\nReturn comprehensive JSON with:
        - soap_note (full SOAP format)
        - entities (all medical entities)
        - summary (concise encounter summary)
        - icd10_codes (relevant diagnosis codes with confidence scores)
        - cpt_codes (procedure codes if applicable)
        - risk_factors (clinical risk assessment)
        - follow_up_recommendations
        - documentation_quality_score (0-100)`;
        break;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GPT-5 API error:', errorText);
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const result = await response.json();
    const analysis = JSON.parse(result.choices[0].message.content);

    console.log('✅ GPT-5 analysis complete:', {
      type: analysis_type,
      tokens: result.usage.total_tokens
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysis,
        tokens_used: result.usage.total_tokens,
        model: 'gpt-5-2025-08-07'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ GPT-5 analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
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
