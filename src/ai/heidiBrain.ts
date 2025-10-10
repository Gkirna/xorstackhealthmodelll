import { supabase } from '@/integrations/supabase/client';
import { buildNoteGenerationPrompt, NoteGenerationContext } from './prompts/noteGeneration';
import { buildTaskExtractionPrompt, taskExtractionToolDefinition, TaskExtractionContext } from './prompts/taskExtraction';
import { buildCodeSuggestionPrompt, CodeSuggestionContext } from './prompts/codeSuggestion';
import { buildEncounterSummaryPrompt, EncounterSummaryContext } from './prompts/encounterSummary';
import { buildAskHeidiPrompt, AskHeidContext } from './prompts/askHeidi';
import { getSessionContext, scrubPHI, validateAIOutput, estimateTokens } from '@/lib/contextManager';

const LOVABLE_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// Temperature presets for different AI operations
const TEMPERATURE_PRESETS = {
  noteGeneration: 0.3,
  taskExtraction: 0.2,
  codeSuggestion: 0.2,
  assistant: 0.4,
  summary: 0.3,
} as const;

// Max token limits for different operations
const MAX_TOKENS = {
  noteGeneration: 4000,
  taskExtraction: 2000,
  codeSuggestion: 1500,
  assistant: 2000,
  summary: 500,
} as const;

interface AICallOptions {
  temperature?: number;
  maxTokens?: number;
  logToDatabase?: boolean;
}

/**
 * Core AI call function with standardized error handling and logging
 */
async function callAI(
  messages: { role: string; content: string }[],
  options: AICallOptions & {
    function_name: string;
    session_id?: string;
    tools?: any[];
    tool_choice?: any;
  }
): Promise<any> {
  const startTime = Date.now();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const requestBody: any = {
      model: 'google/gemini-2.5-flash',
      messages,
      temperature: options.temperature || 0.3,
    };

    if (options.maxTokens) {
      requestBody.max_tokens = options.maxTokens;
    }

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    if (options.tool_choice) {
      requestBody.tool_choice = options.tool_choice;
    }

    const response = await fetch(`${LOVABLE_AI_URL}/${options.function_name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error (${options.function_name}):`, response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits required. Please add credits to your workspace.');
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    // Log to ai_logs if enabled
    if (options.logToDatabase !== false && session.user) {
      const inputText = messages.map(m => m.content).join(' ');
      const inputHash = await hashText(inputText.substring(0, 1000));

      await supabase.from('ai_logs').insert({
        user_id: session.user.id,
        session_id: options.session_id || null,
        function_name: options.function_name,
        input_hash: inputHash,
        output_preview: JSON.stringify(data).substring(0, 200),
        duration_ms: duration,
        status: 'success',
      });
    }

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && options.logToDatabase !== false) {
      await supabase.from('ai_logs').insert({
        user_id: session.user.id,
        session_id: options.session_id || null,
        function_name: options.function_name,
        duration_ms: duration,
        status: 'error',
        error_message: errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Simple hash function for logging (not cryptographic)
 */
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Generate clinical note from transcript
 */
export async function generateClinicalNote(
  session_id: string,
  transcript: string,
  detail_level: 'low' | 'medium' | 'high' = 'medium'
): Promise<{
  success: boolean;
  note?: string;
  note_json?: any;
  warnings?: string[];
  error?: string;
}> {
  try {
    if (!session_id || !transcript.trim()) {
      throw new Error('Session ID and transcript are required');
    }

    const { data, error } = await supabase.functions.invoke('generate-note', {
      body: {
        session_id,
        transcript_text: transcript,
        detail_level
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No response from note generation');
    }

    if (!data.success) {
      throw new Error(data.error?.message || 'Note generation failed');
    }

    return {
      success: true,
      note: data.note,
      note_json: data.note_json,
      warnings: data.warnings || []
    };
  } catch (error) {
    console.error('Error in generateClinicalNote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract tasks from clinical note
 */
export async function extractTasks(
  session_id: string,
  note_text: string
): Promise<{
  success: boolean;
  tasks?: any[];
  warnings?: string[];
  error?: string;
}> {
  try {
    if (!session_id || !note_text.trim()) {
      throw new Error('Session ID and note text are required');
    }

    const { data, error } = await supabase.functions.invoke('extract-tasks', {
      body: {
        session_id,
        note_text
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No response from task extraction');
    }

    if (!data.success) {
      throw new Error(data.error?.message || 'Task extraction failed');
    }

    return {
      success: true,
      tasks: data.tasks || [],
      warnings: []
    };
  } catch (error) {
    console.error('Error in extractTasks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Suggest ICD-10 codes
 */
export async function suggestCodes(
  session_id: string,
  note_text: string,
  region: string = 'US'
): Promise<{
  success: boolean;
  codes?: any[];
  warnings?: string[];
  error?: string;
}> {
  try {
    if (!session_id || !note_text.trim()) {
      throw new Error('Session ID and note text are required');
    }

    const { data, error } = await supabase.functions.invoke('suggest-codes', {
      body: {
        session_id,
        note_text,
        region
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No response from code suggestion');
    }

    if (!data.success) {
      throw new Error(data.error?.message || 'Code suggestion failed');
    }

    return {
      success: true,
      codes: data.codes || [],
      warnings: []
    };
  } catch (error) {
    console.error('Error in suggestCodes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Summarize clinical encounter
 */
export async function summarizeEncounter(
  session_id: string,
  transcript_chunk: string
): Promise<{
  success: boolean;
  summary?: string;
  warnings?: string[];
  error?: string;
}> {
  try {
    const context = await getSessionContext(session_id);

    const promptContext: EncounterSummaryContext = {
      transcript_chunk,
      patient_name: context?.patient_name,
      visit_type: context?.visit_mode,
    };

    const { system, user } = buildEncounterSummaryPrompt(promptContext);

    const response = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      {
        function_name: 'summarize-transcript',
        session_id,
        temperature: TEMPERATURE_PRESETS.summary,
        maxTokens: MAX_TOKENS.summary,
      }
    );

    const summary = response.choices?.[0]?.message?.content || '';
    
    const validation = validateAIOutput(summary, 'text');

    // Update session
    await supabase
      .from('sessions')
      .update({
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return {
      success: true,
      summary,
      warnings: validation.warnings,
    };
  } catch (error) {
    console.error('Error in summarizeEncounter:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ask Heidi AI assistant
 */
export async function askHeidiAssistant(
  question: string,
  session_id?: string,
  context_snippet?: string
): Promise<{
  success: boolean;
  answer?: string;
  citations?: string[];
  warnings?: string[];
  error?: string;
}> {
  try {
    if (!question || !question.trim()) {
      throw new Error('Question is required');
    }

    const { data, error } = await supabase.functions.invoke('ask-heidi', {
      body: {
        question: question.trim(),
        session_id,
        context_snippet
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No response from AI assistant');
    }

    if (!data.success) {
      throw new Error(data.error?.message || 'AI assistant request failed');
    }

    return {
      success: true,
      answer: data.answer,
      citations: data.citations || [],
      warnings: []
    };
  } catch (error) {
    console.error('Error in askHeidiAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
