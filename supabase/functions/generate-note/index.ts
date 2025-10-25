// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; 
import express from "express";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createClient } from "@supabase/supabase-js";
import { env } from "process";
import dotenv from "dotenv";
dotenv.config();

const app = express();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}
app.post('/generate-note', async (req, res) => {
  if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { session_id, transcript_text, detail_level = 'medium' } = await req.json();

    if (!session_id || !transcript_text) {
      throw new Error('Missing required fields: session_id, transcript_text');
    }

    const startTime = Date.now();

    // Call Lovable AI (Gemini 2.5 Flash)
    const LOVABLE_API_KEY = process.env.VITE_LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an expert medical scribe assistant with extensive knowledge of clinical documentation standards.

Detail level: ${detail_level}

CRITICAL INSTRUCTIONS:
1. Generate a comprehensive, accurate clinical note following SOAP format
2. Use appropriate medical terminology and ICD-10 compatible language
3. Include specific measurements, dosages, and clinical findings
4. Maintain professional medical documentation standards
5. Preserve patient safety information and critical alerts
6. Structure the output as valid JSON

Output format (MUST be valid JSON):
{
  "soap": {
    "subjective": "Patient-reported symptoms, history, concerns",
    "objective": "Vital signs, physical exam findings, test results",
    "assessment": "Diagnosis, differential diagnoses, clinical impression",
    "plan": "Treatment plan, medications, follow-up, patient education"
  },
  "plaintext": "Full formatted clinical note with all SOAP sections"
}

Quality criteria:
- Accuracy: All information from transcript included
- Completeness: No critical details omitted
- Clarity: Medical terminology used appropriately
- Structure: Logical flow and organization
- Compliance: Follows documentation standards`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a clinical note from this transcript:\n\n${transcript_text}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
      }
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || '';
    
    let noteData;
    try {
      noteData = JSON.parse(generatedContent);
    } catch {
      noteData = {
        soap: { subjective: '', objective: '', assessment: '', plan: '' },
        plaintext: generatedContent
      };
    }

    const duration = Date.now() - startTime;

    // Update session with generated note
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        generated_note: noteData.plaintext,
        note_json: noteData.soap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw updateError;
    }

    // Log AI usage (scrub PHI)
    const inputHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(transcript_text)
    );
    const hashArray = Array.from(new Uint8Array(inputHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await supabase.from('ai_logs').insert({
      user_id: user.id,
      session_id,
      function_name: 'generate-note',
      input_hash: hashHex.substring(0, 16),
      output_preview: noteData.plaintext?.substring(0, 100) || '',
      tokens_used: aiData.usage?.total_tokens || 0,
      duration_ms: duration,
      status: 'success',
    });

    return new Response(
      JSON.stringify({
        success: true,
        note: noteData.plaintext,
        note_json: noteData.soap,
        warnings: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'GENERATION_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
