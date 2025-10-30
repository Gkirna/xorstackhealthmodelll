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
    const { session_id, transcript_text, detail_level = 'medium', template = 'soap' } = requestData;

    if (!session_id || !transcript_text) {
      throw new Error('Missing required fields: session_id, transcript_text');
    }

    console.log(`Generating ${template} note with ${detail_level} detail level`);

    const startTime = Date.now();

    // Use OpenAI GPT-5 for superior medical documentation
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'Service temporarily unavailable' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TEMPLATE_STRUCTURES = {
      soap: {
        subjective: "Patient-reported symptoms, history, concerns",
        objective: "Vital signs, physical exam findings, test results",
        assessment: "Diagnosis, differential diagnoses, clinical impression",
        plan: "Treatment plan, medications, follow-up, patient education"
      },
      hpi: {
        hpi: "History of Present Illness with timeline",
        physical_exam: "Physical examination findings",
        assessment: "Clinical assessment and diagnoses",
        plan: "Diagnostic workup, treatment, medications"
      },
      progress: {
        interval_history: "Changes since last visit",
        current_status: "Current symptoms and status",
        assessment: "Updated clinical assessment",
        plan: "Treatment changes and follow-up"
      },
      discharge: {
        admission_diagnosis: "Reason for admission",
        hospital_course: "Summary of hospital stay",
        discharge_diagnosis: "Final diagnoses",
        discharge_medications: "Medication list",
        follow_up: "Follow-up instructions"
      }
    };

    const templateStructure = TEMPLATE_STRUCTURES[template as keyof typeof TEMPLATE_STRUCTURES] || TEMPLATE_STRUCTURES.soap;
    const sections = Object.entries(templateStructure)
      .map(([key, desc]) => `    "${key}": "${desc}"`)
      .join(',\n');

    const systemPrompt = `You are an elite medical documentation specialist with board certification knowledge across all specialties. You have extensive experience with EHR systems, clinical decision support, and medical-legal documentation.

Template: ${template.toUpperCase()}
Detail level: ${detail_level}

CRITICAL INSTRUCTIONS:
1. Generate comprehensive, legally defensible clinical documentation using the ${template} template
2. Extract and attribute information from speaker-labeled transcript (Doctor:/Patient:/Nurse: prefixes)
3. Use precise medical terminology with ICD-10/CPT compatibility
4. Include specific measurements, dosages, vital signs, and clinical findings with units
5. Maintain SOAP/HIPAA compliance and professional medical standards
6. Highlight patient safety information, allergies, and critical alerts
7. Integrate clinical reasoning and differential diagnoses
8. Structure output as valid JSON

Output format (MUST be valid JSON):
{
  "template": "${template}",
  "sections": {
${sections}
  },
  "plaintext": "Full formatted clinical note with proper section headers, bullet points, and medical formatting",
  "metadata": {
    "icd10_codes": ["suggested ICD-10 codes"],
    "medications_mentioned": ["list of medications"],
    "allergies": ["noted allergies"],
    "vital_signs": {"bp": "120/80", "hr": "72", "temp": "98.6"},
    "critical_flags": ["any safety concerns"]
  }
}

Quality criteria:
- Medical Accuracy: Clinically sound with proper terminology
- Completeness: All critical patient information captured
- Legal Defensibility: Meets documentation standards for liability protection
- Clinical Reasoning: Clear assessment and treatment rationale
- Speaker Attribution: Correctly identify doctor vs patient statements
- Actionability: Clear next steps and follow-up
- Compliance: HIPAA-compliant, no unnecessary PHI exposure`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate a ${detail_level} detail ${template} clinical note from this medical encounter transcript:\n\n${transcript_text}\n\nProvide comprehensive documentation with proper medical formatting, section headers, and metadata.` 
          }
        ],
        max_completion_tokens: detail_level === 'high' ? 16000 : detail_level === 'medium' ? 8000 : 4000,
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
        noteData.template = 'soap';
      }
    } catch {
      // Fallback for non-JSON responses
      noteData = {
        template: template,
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
        template: noteData.template || template,
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
