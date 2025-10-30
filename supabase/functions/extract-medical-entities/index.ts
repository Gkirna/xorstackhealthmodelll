import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { text, segments } = await req.json();

    if (!text) {
      throw new Error('No text provided for entity extraction');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Service temporarily unavailable' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🏥 Extracting medical entities with GPT-5 ultra-advanced NER...');

    const systemPrompt = `You are an elite medical NER (Named Entity Recognition) system with extensive medical knowledge across all specialties. Extract all clinically relevant entities from medical transcripts with maximum precision and clinical context.

Entity types to identify:
- medication: Drug names, prescriptions (include generic/brand names)
- diagnosis: Diseases, conditions, disorders (with ICD-10 mapping when possible)
- procedure: Medical procedures, surgeries, tests, interventions
- symptom: Patient-reported symptoms and complaints
- anatomy: Body parts, organs, systems, anatomical locations
- dosage: Medication dosages, frequencies, routes of administration
- vital_sign: Blood pressure, heart rate, temperature, SpO2, respiratory rate
- allergy: Known allergies and adverse reactions

For each entity provide:
- Exact text match from transcript
- Entity type classification
- Character position (start/end)
- Confidence score (0-1) based on context clarity
- Metadata with clinical context (severity, laterality, temporal info, etc.)

Return structured JSON with high-confidence entities only (>0.7).`;

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
          { 
            role: 'user', 
            content: `Extract all clinically relevant medical entities from this transcript. Focus on accuracy and completeness:\n\n${text}` 
          }
        ],
        max_completion_tokens: 8000,
        tools: [{
          type: 'function',
          function: {
            name: 'extract_medical_entities',
            description: 'Extract medical entities from clinical text with detailed metadata',
            parameters: {
              type: 'object',
              properties: {
                entities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: 'The exact entity text from transcript' },
                      type: { 
                        type: 'string', 
                        enum: ['medication', 'diagnosis', 'procedure', 'symptom', 'anatomy', 'dosage', 'vital_sign', 'allergy'],
                        description: 'Entity classification'
                      },
                      start: { type: 'number', description: 'Character start position' },
                      end: { type: 'number', description: 'Character end position' },
                      confidence: { type: 'number', description: 'Confidence score 0-1' },
                      metadata: { 
                        type: 'object',
                        description: 'Clinical context (severity, laterality, timing, etc.)',
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
      console.error('OpenAI API error:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'EXTRACTION_ERROR', message: 'Entity extraction failed' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'NO_ENTITIES', message: 'No entities found' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entities: MedicalEntity[] = JSON.parse(toolCall.function.arguments).entities;

    console.log(`✅ Extracted ${entities.length} medical entities with GPT-5 ultra-advanced NER`);

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
    console.error('❌ Ultra-advanced medical entity extraction error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: { code: 'ENTITY_EXTRACTION_ERROR', message: 'An error occurred during entity extraction' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
