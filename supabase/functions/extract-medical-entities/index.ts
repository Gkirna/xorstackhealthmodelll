import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicalEntity {
  text: string;
  type: 'medication' | 'diagnosis' | 'procedure' | 'symptom' | 'anatomy' | 'dosage' | 'vital_sign' | 'allergy';
  start: number;
  end: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const inputSchema = z.object({
      text: z.string().min(1).max(50000),
      segments: z.any().optional()
    });

    const body = await req.json();
    const { text, segments } = inputSchema.parse(body);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🏥 Extracting medical entities from transcript...');

    const systemPrompt = `You are an expert medical NER (Named Entity Recognition) system. Extract all medical entities from clinical transcripts with high precision.

Entity types to identify:
- medication: Drug names, prescriptions
- diagnosis: Diseases, conditions, disorders
- procedure: Medical procedures, surgeries, tests
- symptom: Patient-reported symptoms
- anatomy: Body parts, organs, systems
- dosage: Medication dosages and frequencies
- vital_sign: Blood pressure, heart rate, temperature, etc.
- allergy: Known allergies

Return entities with their exact position in text and confidence score (0-1).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Extract all medical entities from this clinical transcript:\n\n${text}` 
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_medical_entities',
            description: 'Extract medical entities from clinical text',
            parameters: {
              type: 'object',
              properties: {
                entities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: 'The entity text' },
                      type: { 
                        type: 'string', 
                        enum: ['medication', 'diagnosis', 'procedure', 'symptom', 'anatomy', 'dosage', 'vital_sign', 'allergy'],
                        description: 'Entity type'
                      },
                      start: { type: 'number', description: 'Start position in text' },
                      end: { type: 'number', description: 'End position in text' },
                      confidence: { type: 'number', description: 'Confidence score 0-1' },
                      metadata: { 
                        type: 'object',
                        description: 'Additional context',
                        additionalProperties: true
                      }
                    },
                    required: ['text', 'type', 'start', 'end', 'confidence'],
                    additionalProperties: false
                  }
                }
              },
              required: ['entities'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_medical_entities' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No entities extracted from AI response');
    }

    const entities: MedicalEntity[] = JSON.parse(toolCall.function.arguments).entities;

    console.log(`✅ Extracted ${entities.length} medical entities`);

    // Calculate entity statistics
    const entityStats = entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(
      JSON.stringify({
        success: true,
        entities,
        statistics: {
          total_entities: entities.length,
          by_type: entityStats,
          avg_confidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length || 0,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Medical entity extraction error');
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input parameters',
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'ENTITY_EXTRACTION_ERROR',
          message: 'An error occurred processing your request',
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
