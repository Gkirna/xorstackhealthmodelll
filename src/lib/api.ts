import { supabase } from '@/integrations/supabase/client';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Call a Supabase Edge Function with proper auth
 */
export async function callEdgeFunction<T = any>(
  functionName: string,
  body?: any
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      throw error;
    }

    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    return {
      success: false,
      error: {
        code: 'FUNCTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Generate clinical note from transcript
 */
export async function generateNote(
  session_id: string,
  transcript_text: string,
  detail_level: 'low' | 'medium' | 'high' = 'medium'
) {
  return callEdgeFunction('generate-note', {
    session_id,
    transcript_text,
    detail_level,
  });
}

/**
 * Extract tasks from clinical note
 */
export async function extractTasks(session_id: string, note_text: string) {
  const response = await callEdgeFunction<{ tasks?: any[] }>('extract-tasks', {
    session_id,
    note_text,
  });
  
  // Transform the response to match expected format
  if (response.success && response.data && 'tasks' in response.data) {
    return {
      success: true,
      data: (response.data as any).tasks,
    };
  }
  
  return response;
}

/**
 * Suggest ICD-10 codes from clinical note
 */
export async function suggestCodes(
  session_id: string,
  note_text: string,
  region: string = 'US'
) {
  const response = await callEdgeFunction<{ codes?: any[] }>('suggest-codes', {
    session_id,
    note_text,
    region,
  });
  
  // Transform the response to match expected format
  if (response.success && response.data && 'codes' in response.data) {
    return {
      success: true,
      data: (response.data as any).codes,
    };
  }
  
  return response;
}

/**
 * Ask Heidi AI assistant a question
 */
export async function askHeidi(
  question: string,
  session_id?: string,
  context_snippet?: string
) {
  return callEdgeFunction('ask-heidi', {
    question,
    session_id,
    context_snippet,
  });
}

/**
 * Summarize transcript
 */
export async function summarizeTranscript(
  session_id: string,
  transcript_chunk: string
) {
  return callEdgeFunction('summarize-transcript', {
    session_id,
    transcript_chunk,
  });
}

/**
 * Export clinical note
 */
export async function exportNote(
  session_id: string,
  format: 'pdf' | 'docx' | 'txt' = 'pdf',
  recipient_email?: string
) {
  return callEdgeFunction('export-note', {
    session_id,
    format,
    recipient_email,
  });
}

/**
 * Log an event
 */
export async function logEvent(
  type: string,
  payload?: any,
  create_notification: boolean = false
) {
  return callEdgeFunction('log-event', {
    type,
    payload,
    create_notification,
  });
}
