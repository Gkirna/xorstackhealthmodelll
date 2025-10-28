/**
 * Transcription Cleanup Service
 * Automatically cleans up transcription text using GPT-4
 * Fixes grammar, misheard words, and preserves medical meaning
 */

import OpenAI from 'openai';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

interface TranscriptionCleanupOptions {
  preserveSpeakers?: boolean;
  preserveTimestamps?: boolean;
  medicalContext?: boolean;
  language?: string;
}

interface CleanupResult {
  originalText: string;
  cleanedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  confidence: number;
  processingTime: number;
}

/**
 * Clean up transcription text using GPT-4
 * Automatically fixes grammar, misheard words, and preserves medical meaning
 */
export async function cleanupTranscription(
  text: string,
  options: TranscriptionCleanupOptions = {
    preserveSpeakers: true,
    preserveTimestamps: false,
    medicalContext: true,
    language: 'en-US'
  }
): Promise<CleanupResult> {
  const startTime = Date.now();

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // Required for client-side usage
    });

    // Build the prompt based on options
    const prompt = buildCleanupPrompt(text, options);

    console.log('🤖 Sending transcription to GPT for cleanup...');

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: options.medicalContext
            ? `You are a medical transcription specialist. Your task is to clean up transcriptions of clinical conversations while preserving ALL medical terminology, conditions, treatments, and clinical context. 
            - Fix grammar and punctuation
            - Correct misheard words while preserving medical accuracy
            - Maintain professional medical language
            - Preserve speaker labels if present
            - Keep all medical terms, diagnoses, medications, and procedures intact
            - Do NOT add medical information that wasn't in the original
            - Return ONLY the cleaned text, no explanations`
            : `You are a transcription cleanup specialist. Your task is to clean up transcription text while preserving the meaning and context.
            - Fix grammar and punctuation
            - Correct misheard words
            - Maintain the original tone and context
            - Preserve speaker labels if present
            - Return ONLY the cleaned text, no explanations`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 4000
    });

    const cleanedText = response.choices[0]?.message?.content || text;
    const processingTime = Date.now() - startTime;

    console.log('✅ Transcription cleaned successfully');

    // Extract corrections (GPT doesn't provide this directly, so we'll do a simple diff)
    const corrections = extractCorrections(text, cleanedText);

    return {
      originalText: text,
      cleanedText: cleanedText.trim(),
      corrections,
      confidence: 0.95, // High confidence for GPT cleanup
      processingTime
    };
  } catch (error) {
    console.error('❌ Transcription cleanup failed:', error);
    
    // Return original text if cleanup fails
    return {
      originalText: text,
      cleanedText: text,
      corrections: [],
      confidence: 0.5,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Build the cleanup prompt based on options
 */
function buildCleanupPrompt(text: string, options: TranscriptionCleanupOptions): string {
  let prompt = `Clean up the following transcription:\n\n`;
  
  if (options.preserveSpeakers && text.includes('Doctor:') || text.includes('Patient:')) {
    prompt += `(Preserve speaker labels like "Doctor:" and "Patient:")\n\n`;
  }
  
  if (options.medicalContext) {
    prompt += `(This is a medical/clinical transcription - preserve all medical terminology, conditions, and clinical context)\n\n`;
  }
  
  prompt += `${text}`;
  
  return prompt;
}

/**
 * Extract corrections by comparing original and cleaned text
 * Simple implementation - can be enhanced with more sophisticated diff algorithms
 */
function extractCorrections(original: string, cleaned: string): Array<{
  original: string;
  corrected: string;
  reason: string;
}> {
  const corrections: Array<{ original: string; corrected: string; reason: string }> = [];
  
  // Simple word-by-word comparison
  const originalWords = original.toLowerCase().split(/\s+/);
  const cleanedWords = cleaned.toLowerCase().split(/\s+/);
  
  // This is a simplified implementation
  // For production, consider using a proper diff algorithm
  if (originalWords.length !== cleanedWords.length) {
    corrections.push({
      original: original.slice(0, 50),
      corrected: cleaned.slice(0, 50),
      reason: 'Text length changed after cleanup'
    });
  }
  
  return corrections;
}

/**
 * Batch cleanup multiple transcriptions
 */
export async function cleanupTranscriptionsBatch(
  texts: string[],
  options: TranscriptionCleanupOptions = {}
): Promise<CleanupResult[]> {
  console.log(`🤖 Cleaning up ${texts.length} transcriptions in batch...`);
  
  const results = await Promise.all(
    texts.map(text => cleanupTranscription(text, options))
  );
  
  console.log(`✅ Batch cleanup completed for ${texts.length} transcriptions`);
  
  return results;
}

/**
 * Cleanup with retry logic for reliability
 */
export async function cleanupTranscriptionWithRetry(
  text: string,
  options: TranscriptionCleanupOptions = {},
  maxRetries: number = 3
): Promise<CleanupResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🤖 Cleanup attempt ${attempt}/${maxRetries}`);
      return await cleanupTranscription(text, options);
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Cleanup attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  // If all retries failed, return original text
  console.error('❌ All cleanup attempts failed, returning original text');
  return {
    originalText: text,
    cleanedText: text,
    corrections: [],
    confidence: 0.3,
    processingTime: 0
  };
}

/**
 * Quick cleanup for real-time transcription (faster but less thorough)
 */
export async function quickCleanup(
  text: string,
  medicalContext: boolean = true
): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: medicalContext
            ? `Fix grammar and punctuation in this medical transcription. Keep all medical terms intact. Return only the cleaned text.`
            : `Fix grammar and punctuation. Return only the cleaned text.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error('Quick cleanup failed:', error);
    return text; // Return original on failure
  }
}
