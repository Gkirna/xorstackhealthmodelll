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

    const { session_id, note_text } = await req.json();

    if (!session_id || !note_text) {
      throw new Error('Missing required fields: session_id, note_text');
    }

    const startTime = Date.now();

    // Call Lovable AI with tool calling for structured extraction
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
            content: `Extract actionable follow-up tasks from clinical notes with high precision.

TASK CATEGORIES:
- diagnostic: Lab work, imaging, tests
- follow-up: Appointments, check-ins, monitoring
- referral: Specialist consultations
- medication: Prescriptions, refills, adjustments
- patient_education: Instructions, resources, counseling
- administrative: Paperwork, insurance, documentation

PRIORITY ASSESSMENT:
- high: Urgent, time-sensitive, safety-critical
- medium: Important but not urgent
- low: Routine, non-critical

Extract tasks that are:
1. Explicitly mentioned in the note
2. Clinically necessary based on findings
3. Actionable and specific
4. Patient-safety relevant`
          },
          {
            role: 'user',
            content: `Extract follow-up tasks from this clinical note:\n\n${note_text}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_tasks',
            description: 'Extract actionable tasks from the clinical note',
            parameters: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                      category: { type: 'string' }
                    },
                    required: ['title', 'priority', 'category'],
                    additionalProperties: false
                  }
                }
              },
              required: ['tasks'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_tasks' } }
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
      throw new Error('Task extraction failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI Response structure:', JSON.stringify(aiData, null, 2).substring(0, 500));
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let extractedTasks = [];

    if (toolCall?.function?.arguments) {
      try {
        const argsString = typeof toolCall.function.arguments === 'string' 
          ? toolCall.function.arguments 
          : JSON.stringify(toolCall.function.arguments);
        const parsed = JSON.parse(argsString);
        extractedTasks = parsed.tasks || [];
        console.log(`Successfully extracted ${extractedTasks.length} tasks`);
      } catch (e) {
        console.error('Failed to parse tool response:', e);
        console.error('Tool call arguments:', toolCall.function.arguments);
      }
    } else {
      console.warn('No tool calls found in AI response');
      console.warn('Response choices:', aiData.choices?.[0]?.message);
    }

    const duration = Date.now() - startTime;

    // Insert tasks into database
    const tasksToInsert = extractedTasks.map((task: any) => ({
      user_id: user.id,
      session_id,
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      category: task.category || 'general',
      status: 'pending'
    }));

    if (tasksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('tasks')
        .insert(tasksToInsert);

      if (insertError) {
        console.error('Error inserting tasks:', insertError);
        throw insertError;
      }
    }

    // Log AI usage
    await supabase.from('ai_logs').insert({
      user_id: user.id,
      session_id,
      function_name: 'extract-tasks',
      output_preview: `Extracted ${extractedTasks.length} tasks`,
      tokens_used: aiData.usage?.total_tokens || 0,
      duration_ms: duration,
      status: 'success',
    });

    return new Response(
      JSON.stringify({
        success: true,
        tasks: extractedTasks,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'EXTRACTION_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
