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

    const systemPrompt = `You are an expert medical scribe assistant with extensive knowledge of clinical documentation standards and advanced speaker diarization analysis.

Template: ${templateName}
Detail level: ${detail_level}

CRITICAL INSTRUCTIONS FOR SPEAKER-AWARE CLINICAL DOCUMENTATION:

1. **SPEAKER DIARIZATION ANALYSIS**:
   - The transcript contains speaker-labeled segments with "Doctor:" and "Patient:" prefixes
   - Carefully analyze which statements come from the doctor vs. patient
   - Extract subjective complaints ONLY from patient statements
   - Extract clinical observations and assessments ONLY from doctor statements
   - Maintain clear attribution throughout the clinical note

2. **CLINICAL NOTE STRUCTURE**:
   - Subjective (S): Patient's own words, complaints, and symptoms (ONLY from "Patient:" segments)
   - Objective (O): Doctor's observations, examination findings, vital signs (ONLY from "Doctor:" segments)
   - Assessment (A): Doctor's clinical interpretation and diagnosis (ONLY from "Doctor:" segments)
   - Plan (P): Treatment plan, prescriptions, follow-up (ONLY from "Doctor:" segments)

3. **MEDICAL ACCURACY**:
   - Use appropriate medical terminology and ICD-10 compatible language
   - Include specific measurements, dosages, and clinical findings
   - Maintain professional medical documentation standards
   - Preserve patient safety information and critical alerts

4. **LANGUAGE HANDLING**:
   - The transcript may be in any language (English, Hindi, Kannada, etc.)
   - Always translate and generate the clinical note in ENGLISH
   - Use standard English medical terminology
   - Preserve all clinical details during translation
   - Section headers must be in English

5. **OUTPUT FORMAT**:
   - Structure the output as valid JSON
   - Clearly separate doctor observations from patient statements
   - Maintain chronological flow of the conversation

Output format (MUST be valid JSON):
{
  "template_id": "${template_id || 'default'}",
  "sections": {
${sections}
  },
  "plaintext": "Full formatted clinical note with proper section headers and content IN ENGLISH"
}

QUALITY CRITERIA:
- **Accuracy**: All information from transcript included with correct speaker attribution
- **Completeness**: No critical details omitted, all speakers properly identified
- **Clarity**: Medical terminology used appropriately with clear source attribution
- **Structure**: Logical flow separating patient complaints from doctor findings
- **Speaker Diarization**: Perfect identification of doctor vs patient statements
- **Clinical Relevance**: Patient statements in Subjective, doctor findings in Objective/Assessment/Plan
- **Compliance**: Follows medical documentation standards
- **Language**: Clinical note must always be in English

EXAMPLE OUTPUT STRUCTURE:
{
  "sections": {
    "subjective": "Patient reports [symptoms from Patient: segments]",
    "objective": "Physical examination reveals [findings from Doctor: segments]",
    "assessment": "Clinical diagnosis based on [doctor's assessment from Doctor: segments]",
    "plan": "Treatment plan includes [interventions from Doctor: segments]"
  },
  "plaintext": "Formatted clinical note with proper speaker-based sections"
}`;

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
          { role: 'user', content: `Generate a clinical note from this SPEAKER-LABELED transcript. 

CRITICAL: The transcript contains "Doctor:" and "Patient:" labels that MUST be used to correctly attribute statements:
- Statements after "Doctor:" are from the healthcare provider
- Statements after "Patient:" are from the patient

IMPORTANT: 
1. Generate the note in ENGLISH, translating any non-English content while preserving medical accuracy
2. Patient complaints and symptoms → Subjective section (from "Patient:" segments)
3. Doctor observations and findings → Objective section (from "Doctor:" segments)  
4. Doctor diagnosis → Assessment section (from "Doctor:" segments)
5. Doctor treatment plan → Plan section (from "Doctor:" segments)

SPEAKER-LABELED TRANSCRIPT:
${transcript_text}` }
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
