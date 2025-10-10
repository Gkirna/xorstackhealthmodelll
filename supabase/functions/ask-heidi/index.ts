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

    const { session_id, context_snippet, question } = await req.json();

    if (!question) {
      throw new Error('Missing required field: question');
    }

    const startTime = Date.now();

    // Get session context if session_id provided
    let sessionContext = '';
    if (session_id) {
      const { data: session } = await supabase
        .from('sessions')
        .select('generated_note, patient_name')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (session) {
        sessionContext = `Patient: ${session.patient_name}\n\nClinical Note:\n${session.generated_note || 'No note generated yet'}\n\n`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const contextText = context_snippet || sessionContext;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are Heidi, an AI medical assistant helping clinicians with clinical documentation and medical questions. Provide accurate, evidence-based answers. If context is provided, reference it in your response.'
          },
          {
            role: 'user',
            content: contextText ? `Context:\n${contextText}\n\nQuestion: ${question}` : question
          }
        ],
        temperature: 0.4,
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
      throw new Error('AI assistant request failed');
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.';

    const duration = Date.now() - startTime;

    // Log AI usage
    await supabase.from('ai_logs').insert({
      user_id: user.id,
      session_id: session_id || null,
      function_name: 'ask-heidi',
      output_preview: answer.substring(0, 200),
      tokens_used: aiData.usage?.total_tokens || 0,
      duration_ms: duration,
      status: 'success',
    });

    return new Response(
      JSON.stringify({
        success: true,
        answer,
        citations: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ask-heidi:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'ASSISTANT_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
