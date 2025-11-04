import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const requestData = await req.json();
    const { session_id, transcript_text, detail_level = 'medium', template_id } = requestData;

    if (!session_id || !transcript_text) {
      throw new Error('Missing required fields: session_id, transcript_text');
    }

    // Fetch template from database
    let templateStructure: any = {};
    let templateName = 'Clinical Note';

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('name, structure')
        .eq('id', template_id)
        .single();

      if (template && !templateError) {
        templateStructure = template.structure || {};
        templateName = template.name;
      }
    }

    console.log(`Generating ${templateName} note with ${detail_level} detail level`);

    const startTime = Date.now();

    // Call Lovable AI (Gemini 2.5 Flash)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const sections = Object.entries(templateStructure)
      .map(([key, desc]) => `    "${key}": "${desc}"`)
      .join(',\n');

    const systemPrompt = `You are an expert medical scribe assistant with extensive knowledge of clinical documentation standards.

Template: ${templateName}
Detail level: ${detail_level}

CRITICAL INSTRUCTIONS:
1. Generate a comprehensive, accurate clinical note using the specified template
2. Extract information from speaker-labeled transcript (Doctor: / Patient: prefixes)
3. Use appropriate medical terminology and ICD-10 compatible language
4. Include specific measurements, dosages, and clinical findings
5. Maintain professional medical documentation standards
6. Preserve patient safety information and critical alerts
7. Structure the output as valid JSON
8. **IMPORTANT**: Always generate the clinical note in ENGLISH, regardless of the transcript language
9. Translate any non-English content to English while preserving medical accuracy
10. Use standard English medical terminology

LANGUAGE HANDLING:
- The transcript may be in any language (English, Hindi, Kannada, etc.)
- Always translate and generate the clinical note in English
- Use appropriate English medical terminology
- Preserve all clinical details during translation
- Section headers must be in English

Output format (MUST be valid JSON):
{
  "template_id": "${template_id || 'default'}",
  "sections": {
${sections}
  },
  "plaintext": "Full formatted clinical note with proper section headers and content IN ENGLISH"
}

Quality criteria:
- Accuracy: All information from transcript included
- Completeness: No critical details omitted
- Clarity: Medical terminology used appropriately
- Structure: Logical flow and organization
- Speaker Attribution: Correctly identify doctor vs patient statements
- Compliance: Follows documentation standards
- Language: Clinical note must always be in English`;

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
          { role: 'user', content: `Generate a clinical note from this transcript. IMPORTANT: Generate the note in ENGLISH, translating any non-English content while preserving medical accuracy.\n\nTranscript:\n${transcript_text}` }
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
      // Ensure we have the sections data
      if (!noteData.sections && noteData.soap) {
        // Legacy format conversion
        noteData.sections = noteData.soap;
      }
    } catch {
      // Fallback for non-JSON responses
      noteData = {
        template_id: template_id,
        sections: {},
        plaintext: generatedContent
      };
    }

    const duration = Date.now() - startTime;

    // Update session with generated note
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        generated_note: noteData.plaintext,
        note_json: noteData.sections || noteData.soap || {},
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
        note_json: noteData.sections || noteData.soap || {},
        template_id: noteData.template_id || template_id,
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
