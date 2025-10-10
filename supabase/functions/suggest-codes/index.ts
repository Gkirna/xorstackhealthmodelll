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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    const { session_id, note_text, region = 'US' } = await req.json();

    if (!session_id || !note_text) {
      throw new Error('Missing required fields: session_id, note_text');
    }

    const startTime = Date.now();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are a certified medical coding expert specializing in ${region === 'US' ? 'ICD-10-CM' : 'ICD-10'} diagnosis coding.

CODING GUIDELINES:
1. Identify all diagnoses explicitly stated or clinically implied
2. Code to the highest specificity level available
3. Follow official ICD-10 coding guidelines and conventions
4. Include both primary and secondary diagnoses
5. Consider chronic conditions and comorbidities
6. Ensure code accuracy and medical necessity

CONFIDENCE SCORING:
- 0.9-1.0: Explicitly stated diagnosis with clear documentation
- 0.7-0.89: Strongly implied by clinical findings
- 0.5-0.69: Possible diagnosis requiring clarification
- <0.5: Insufficient documentation (exclude)

OUTPUT REQUIREMENTS:
- Return valid JSON array only
- Include confidence scores for clinical review
- Provide clear, concise code descriptions
- Use ${region === 'US' ? 'ICD-10-CM' : 'ICD-10'} format`;

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
          {
            role: 'user',
            content: `Suggest ICD-10 diagnosis codes for this clinical note. Return ONLY a valid JSON array:\n\n${note_text}\n\nFormat: [{"code": "...", "system": "${region === 'US' ? 'ICD-10-CM' : 'ICD-10'}", "label": "...", "confidence": 0.0-1.0}]`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required');
      }
      throw new Error('Code suggestion failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '[]';
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    // Clean up any leading/trailing text
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      content = arrayMatch[0];
    }
    
    let codes = [];
    try {
      codes = JSON.parse(content);
      console.log(`Successfully parsed ${codes.length} ICD-10 codes`);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content.substring(0, 500));
      codes = [];
    }

    const duration = Date.now() - startTime;

    // Update session with clinical codes (draft)
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        clinical_codes: { suggested: codes, confirmed: [] },
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
    }

    // Log AI usage
    await supabase.from('ai_logs').insert({
      user_id: user.id,
      session_id,
      function_name: 'suggest-codes',
      output_preview: `Suggested ${codes.length} codes`,
      tokens_used: aiData.usage?.total_tokens || 0,
      duration_ms: duration,
      status: 'success',
    });

    return new Response(
      JSON.stringify({
        success: true,
        codes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-codes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SUGGESTION_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
