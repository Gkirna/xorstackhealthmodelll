import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PHI scrubbing patterns
const PHI_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  dob: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  mrn: /\b(MRN|Medical Record Number)[:\s]*[A-Z0-9-]+\b/gi,
};

function scrubPHI(text: string, options: { patient_name?: string; patient_id?: string } = {}): string {
  let scrubbed = text;

  // Scrub pattern-based PHI
  scrubbed = scrubbed.replace(PHI_PATTERNS.ssn, '[SSN]');
  scrubbed = scrubbed.replace(PHI_PATTERNS.phone, '[PHONE]');
  scrubbed = scrubbed.replace(PHI_PATTERNS.email, '[EMAIL]');
  scrubbed = scrubbed.replace(PHI_PATTERNS.dob, '[DOB]');
  scrubbed = scrubbed.replace(PHI_PATTERNS.mrn, '[MRN]');

  // Scrub specific patient identifiers
  if (options.patient_name) {
    const nameRegex = new RegExp(options.patient_name, 'gi');
    scrubbed = scrubbed.replace(nameRegex, '[PATIENT_NAME]');
  }

  if (options.patient_id) {
    const idRegex = new RegExp(options.patient_id, 'gi');
    scrubbed = scrubbed.replace(idRegex, '[PATIENT_ID]');
  }

  return scrubbed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { session_id, maxTokens = 8000, scrubPHIData = true } = await req.json();

    if (!session_id) {
      throw new Error('session_id is required');
    }

    console.log('📋 Fetching session context for:', session_id);

    // Fetch session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError) throw sessionError;
    if (!session) throw new Error('Session not found');

    // Fetch transcripts
    const { data: transcripts, error: transcriptsError } = await supabaseClient
      .from('session_transcripts')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (transcriptsError) throw transcriptsError;

    // Fetch user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user_id)
      .single();

    // Build transcript text
    const transcriptText = transcripts
      ?.map(t => `[${t.speaker}]: ${t.text}`)
      .join('\n') || '';

    // Token estimation (4 chars per token)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    
    let finalTranscript = transcriptText;
    if (estimateTokens(transcriptText) > maxTokens) {
      const charLimit = maxTokens * 4;
      finalTranscript = transcriptText.slice(0, charLimit) + '...';
      console.log(`⚠️ Transcript truncated to ${maxTokens} tokens`);
    }

    // Apply PHI scrubbing if requested
    if (scrubPHIData) {
      finalTranscript = scrubPHI(finalTranscript, {
        patient_name: session.patient_name,
        patient_id: session.patient_id || undefined,
      });
    }

    // Build context object
    const context = {
      session: {
        id: session.id,
        patient_name: scrubPHIData ? '[PATIENT_NAME]' : session.patient_name,
        patient_id: scrubPHIData ? '[PATIENT_ID]' : session.patient_id,
        patient_dob: scrubPHIData ? '[DOB]' : session.patient_dob,
        visit_mode: session.visit_mode,
        appointment_type: session.appointment_type,
        chief_complaint: session.chief_complaint,
        status: session.status,
        created_at: session.created_at,
      },
      provider: {
        id: profile?.id,
        full_name: profile?.full_name,
        specialty: profile?.specialty,
        organization: profile?.organization,
      },
      transcript: finalTranscript,
      transcript_segments: transcripts?.length || 0,
      estimated_tokens: estimateTokens(finalTranscript),
    };

    console.log('✅ Context built successfully:', {
      session_id,
      segments: context.transcript_segments,
      tokens: context.estimated_tokens,
      phi_scrubbed: scrubPHIData,
    });

    return new Response(
      JSON.stringify({ context, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Context building error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Context building failed',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
