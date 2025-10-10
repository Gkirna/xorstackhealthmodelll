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
      await supabase.from('ai_logs').insert({
        user_id: session.user.id,
        session_id: options.session_id || null,
        operation_type: options.function_name,
        model: 'google/gemini-2.5-flash',
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
        operation_type: options.function_name,
        model: 'google/gemini-2.5-flash',
        error: errorMessage,
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
    const context = await getSessionContext(session_id);
    if (!context) {
      throw new Error('Session not found');
    }

    // Validate transcript length
    const tokens = estimateTokens(transcript);
    if (tokens > 30000) {
      return {
        success: false,
        error: 'Transcript too long. Please use summarization first.',
      };
    }

    const promptContext: NoteGenerationContext = {
      transcript,
      visit_mode: context.visit_mode,
      detail_level,
      language: 'en', // TODO: Get from session settings
      specialty: context.specialty,
    };

    const { system, user } = buildNoteGenerationPrompt(promptContext);

    const response = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      {
        function_name: 'generate-note',
        session_id,
        temperature: TEMPERATURE_PRESETS.noteGeneration,
        maxTokens: MAX_TOKENS.noteGeneration,
      }
    );

    const content = response.choices?.[0]?.message?.content || '';
    
    let noteData;
    try {
      noteData = JSON.parse(content);
    } catch {
      // If not valid JSON, treat as plaintext
      noteData = {
        soap: { subjective: '', objective: '', assessment: '', plan: '' },
        plaintext: content
      };
    }

    // Validate output
    const validation = validateAIOutput(noteData, 'json');

    // Update session
    await supabase
      .from('sessions')
      .update({
        generated_note: noteData.plaintext,
        note_json: noteData.soap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return {
      success: true,
      note: noteData.plaintext,
      note_json: noteData.soap,
      warnings: validation.warnings,
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
    const context = await getSessionContext(session_id);

    const promptContext: TaskExtractionContext = {
      note_text,
      specialty: context?.specialty,
    };

    const { system, user } = buildTaskExtractionPrompt(promptContext);

    const response = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      {
        function_name: 'extract-tasks',
        session_id,
        temperature: TEMPERATURE_PRESETS.taskExtraction,
        maxTokens: MAX_TOKENS.taskExtraction,
        tools: [taskExtractionToolDefinition],
        tool_choice: { type: 'function', function: { name: 'extract_tasks' } }
      }
    );

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    let extractedTasks = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        extractedTasks = parsed.tasks || [];
      } catch (e) {
        console.error('Failed to parse tool response:', e);
      }
    }

    // Insert tasks into database
    if (extractedTasks.length > 0) {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) {
        throw new Error('Not authenticated');
      }

      const tasksToInsert = extractedTasks.map((task: any) => ({
        user_id: authSession.user.id,
        session_id,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        category: task.category || 'general',
        status: 'pending'
      }));

      await supabase.from('tasks').insert(tasksToInsert);
    }

    return {
      success: true,
      tasks: extractedTasks,
      warnings: extractedTasks.length === 0 ? ['No tasks extracted'] : [],
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
    const context = await getSessionContext(session_id);

    const promptContext: CodeSuggestionContext = {
      note_text,
      region,
      specialty: context?.specialty,
    };

    const { system, user } = buildCodeSuggestionPrompt(promptContext);

    const response = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      {
        function_name: 'suggest-codes',
        session_id,
        temperature: TEMPERATURE_PRESETS.codeSuggestion,
        maxTokens: MAX_TOKENS.codeSuggestion,
      }
    );

    const content = response.choices?.[0]?.message?.content || '[]';
    
    let codes = [];
    try {
      codes = JSON.parse(content);
      // Filter by confidence threshold
      codes = codes.filter((c: any) => c.confidence >= 0.5);
    } catch {
      console.warn('Failed to parse code suggestions');
    }

    // Update session
    await supabase
      .from('sessions')
      .update({
        clinical_codes: { suggested: codes, confirmed: [] },
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return {
      success: true,
      codes,
      warnings: codes.length === 0 ? ['No codes suggested with sufficient confidence'] : [],
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
    let session_context = '';
    let patient_context = '';
    let specialty = '';

    if (session_id) {
      const context = await getSessionContext(session_id);
      if (context) {
        session_context = context.generated_note || context.summary || '';
        patient_context = `Patient ${context.patient_name}, ${context.visit_mode} visit`;
        specialty = context.specialty || '';
      }
    }

    const promptContext: AskHeidContext = {
      question,
      session_context: session_context || context_snippet,
      patient_context,
      specialty,
    };

    const { system, user } = buildAskHeidiPrompt(promptContext);

    const response = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      {
        function_name: 'ask-heidi',
        session_id,
        temperature: TEMPERATURE_PRESETS.assistant,
        maxTokens: MAX_TOKENS.assistant,
      }
    );

    const answer = response.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.';
    
    const validation = validateAIOutput(answer, 'text');

    return {
      success: true,
      answer,
      citations: [], // TODO: Implement citation extraction if needed
      warnings: validation.warnings,
    };
  } catch (error) {
    console.error('Error in askHeidiAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
