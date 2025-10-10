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

    const systemPrompt = region === 'US' 
      ? 'You are a medical coding expert. Suggest appropriate ICD-10-CM diagnosis codes based on the clinical note provided.'
      : 'You are a medical coding expert. Suggest appropriate ICD-10 diagnosis codes based on the clinical note provided.';

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
            content: `Suggest ICD-10 diagnosis codes for this clinical note:\n\n${note_text}\n\nReturn as JSON array with structure: [{"code": "...", "system": "ICD-10-CM", "label": "...", "confidence": 0.0-1.0}]`
          }
        ],
        temperature: 0.2,
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
    const content = aiData.choices?.[0]?.message?.content || '[]';
    
    let codes = [];
    try {
      codes = JSON.parse(content);
    } catch {
      console.warn('Failed to parse codes, returning empty array');
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
