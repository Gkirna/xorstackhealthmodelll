import { supabase } from '@/integrations/supabase/client';

export interface SessionContext {
  session_id: string;
  patient_name: string;
  patient_id: string;
  patient_dob?: string;
  visit_mode: string;
  generated_note?: string;
  summary?: string;
  transcript_text?: string;
  specialty?: string;
}

/**
 * Scrub personally identifiable information from text
 * This is a basic implementation - production should use more sophisticated methods
 */
export function scrubPHI(text: string, options: {
  patient_name?: string;
  patient_id?: string;
  dob?: string;
} = {}): string {
  let scrubbed = text;

  // Replace patient name with [PATIENT]
  if (options.patient_name) {
    const nameRegex = new RegExp(options.patient_name, 'gi');
    scrubbed = scrubbed.replace(nameRegex, '[PATIENT]');
  }

  // Replace MRN/ID with [ID]
  if (options.patient_id) {
    const idRegex = new RegExp(options.patient_id, 'gi');
    scrubbed = scrubbed.replace(idRegex, '[ID]');
  }

  // Replace DOB with [DOB]
  if (options.dob) {
    const dobRegex = new RegExp(options.dob, 'gi');
    scrubbed = scrubbed.replace(dobRegex, '[DOB]');
  }

  // Generic patterns for common PHI
  // Dates in various formats
  scrubbed = scrubbed.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE]');
  scrubbed = scrubbed.replace(/\b\d{2,4}-\d{2}-\d{2}\b/g, '[DATE]');
  
  // Phone numbers
  scrubbed = scrubbed.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  // Social security numbers
  scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  // Email addresses
  scrubbed = scrubbed.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  return scrubbed;
}

/**
 * Get complete session context for AI operations
 */
export async function getSessionContext(session_id: string): Promise<SessionContext | null> {
  try {
    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError);
      return null;
    }

    // Get session transcripts
    const { data: transcripts, error: transcriptError } = await supabase
      .from('session_transcripts')
      .select('text, speaker, timestamp_offset')
      .eq('session_id', session_id)
      .order('timestamp_offset', { ascending: true });

    if (transcriptError) {
      console.error('Error fetching transcripts:', transcriptError);
    }

    // Combine transcript chunks
    const transcript_text = transcripts
      ?.map(t => `${t.speaker}: ${t.text}`)
      .join('\n') || '';

    // Get user profile for specialty info
    const { data: profile } = await supabase
      .from('profiles')
      .select('specialty')
      .eq('id', session.user_id)
      .single();

    return {
      session_id: session.id,
      patient_name: session.patient_name,
      patient_id: session.patient_id,
      patient_dob: session.patient_dob || undefined,
      visit_mode: session.visit_mode,
      generated_note: session.generated_note || undefined,
      summary: session.summary || undefined,
      transcript_text,
      specialty: profile?.specialty || undefined,
    };
  } catch (error) {
    console.error('Error in getSessionContext:', error);
    return null;
  }
}

/**
 * Build AI-ready context string with token management
 * @param session_id Session ID
 * @param maxTokens Approximate max tokens (default 8000, assuming ~4 chars per token)
 */
export async function buildAIContext(
  session_id: string,
  maxTokens: number = 8000
): Promise<string> {
  const context = await getSessionContext(session_id);
  if (!context) return '';

  const maxChars = maxTokens * 4; // Rough approximation

  let contextString = `Patient: ${context.patient_name} (ID: ${context.patient_id})\n`;
  contextString += `Visit Type: ${context.visit_mode}\n`;
  
  if (context.specialty) {
    contextString += `Specialty: ${context.specialty}\n`;
  }

  if (context.summary) {
    contextString += `\nSummary: ${context.summary}\n`;
  }

  if (context.generated_note) {
    contextString += `\nPrevious Note:\n${context.generated_note}\n`;
  }

  if (context.transcript_text) {
    const remainingChars = maxChars - contextString.length;
    if (context.transcript_text.length > remainingChars) {
      contextString += `\nTranscript (truncated):\n${context.transcript_text.substring(0, remainingChars)}...`;
    } else {
      contextString += `\nTranscript:\n${context.transcript_text}`;
    }
  }

  return contextString;
}

/**
 * Validate AI output for common issues
 */
export function validateAIOutput(output: any, expectedType: 'json' | 'text' = 'text'): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!output) {
    return { valid: false, warnings: ['Output is empty or null'] };
  }

  if (expectedType === 'json') {
    if (typeof output !== 'object') {
      warnings.push('Expected JSON object but got different type');
      return { valid: false, warnings };
    }

    // Check for empty or meaningless responses
    const jsonString = JSON.stringify(output);
    if (jsonString.length < 10) {
      warnings.push('JSON output appears too short or empty');
    }
  }

  if (expectedType === 'text') {
    if (typeof output !== 'string') {
      warnings.push('Expected text string but got different type');
      return { valid: false, warnings };
    }

    if (output.trim().length === 0) {
      warnings.push('Text output is empty');
      return { valid: false, warnings };
    }

    if (output.trim().length < 20) {
      warnings.push('Text output appears unusually short');
    }

    // Check for common AI failure patterns
    if (output.toLowerCase().includes('i cannot') || 
        output.toLowerCase().includes('i apologize') ||
        output.toLowerCase().includes('as an ai')) {
      warnings.push('Output contains AI refusal or apology pattern');
    }
  }

  return {
    valid: warnings.length === 0 || warnings.every(w => !w.includes('empty')),
    warnings
  };
}

/**
 * Calculate estimated tokens for text
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  
  return text.substring(0, maxChars - 3) + '...';
}
