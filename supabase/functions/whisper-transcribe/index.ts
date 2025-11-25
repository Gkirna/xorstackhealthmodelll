import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to your domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per user

// Hash content for audit logging without storing PHI
async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// Check rate limit for user
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const requestStartTime = Date.now();
  console.log(`[${requestId}] 🎙️ Transcription request received`);

  try {
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify user authentication
    let userId = 'anonymous';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      console.log(`[${requestId}] ⚠️ Rate limit exceeded for user: ${userId.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a minute.',
          success: false 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the audio file from FormData
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'en';
    
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    // Validate audio file size (max 25MB as per OpenAI limit)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > MAX_FILE_SIZE) {
      throw new Error('Audio file too large. Maximum size is 25MB.');
    }

    // Validate audio file type (critical for medical transcription)
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/m4a'];
    if (!allowedTypes.some(type => audioFile.type.includes(type))) {
      console.log(`[${requestId}] ⚠️ Audio type: ${audioFile.type} - will let OpenAI validate`);
    }

    console.log(`[${requestId}] 📊 Audio validation:`, {
      size: audioFile.size,
      type: audioFile.type,
      name: audioFile.name || 'unknown'
    });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`[${requestId}] 📊 Processing: ${(audioFile.size / 1024).toFixed(2)} KB, type: ${audioFile.type}, lang: ${language}`);

    // Create form data for OpenAI Whisper API
    const openaiFormData = new FormData();
    
    // CRITICAL FIX: Create clean Blob without codec specification
    // OpenAI rejects "audio/webm;codecs=opus" but accepts "audio/webm"
    const audioBuffer = await audioFile.arrayBuffer();
    let cleanMimeType = audioFile.type.split(';')[0]; // Remove codec specification
    
    // Determine extension and MIME type
    let extension = 'webm';
    if (audioFile.type.includes('mp3') || audioFile.type.includes('mpeg')) {
      extension = 'mp3';
      cleanMimeType = 'audio/mpeg';
    } else if (audioFile.type.includes('wav')) {
      extension = 'wav';
      cleanMimeType = 'audio/wav';
    } else if (audioFile.type.includes('ogg')) {
      extension = 'ogg';
      cleanMimeType = 'audio/ogg';
    } else if (audioFile.type.includes('m4a') || audioFile.type.includes('mp4')) {
      extension = 'm4a';
      cleanMimeType = 'audio/mp4';
    } else if (audioFile.type.includes('webm')) {
      extension = 'webm';
      cleanMimeType = 'audio/webm';
    }
    
    // Create clean blob without codec info
    const cleanAudioBlob = new Blob([audioBuffer], { type: cleanMimeType });
    
    console.log(`[${requestId}] 🔧 Audio format fix:`, {
      original: audioFile.type,
      clean: cleanMimeType,
      extension: extension
    });
    
    openaiFormData.append('file', cleanAudioBlob, `recording.${extension}`);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', language);
    openaiFormData.append('response_format', 'verbose_json'); // Get detailed response
    openaiFormData.append('temperature', '0'); // Precise transcription for medical use
    
    console.log(`[${requestId}] 🚀 Sending to OpenAI Whisper API...`);

    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] ❌ OpenAI API error: ${response.status} - ${errorText}`);
      
      // Parse OpenAI error for better diagnostics
      let errorDetail = 'Transcription service temporarily unavailable';
      try {
        const errorJson = JSON.parse(errorText);
        console.error(`[${requestId}] OpenAI error details:`, errorJson);
        if (errorJson.error?.message) {
          errorDetail = errorJson.error.message;
        }
      } catch (e) {
        // Error text is not JSON
      }
      
      throw new Error(errorDetail);
    }

    const result = await response.json();
    const transcriptHash = await hashContent(result.text);
    const processingTime = Date.now() - requestStartTime;
    
    console.log(`[${requestId}] ✅ Success:`, {
      hash: transcriptHash,
      length: result.text.length,
      language: result.language,
      duration: result.duration ? `${result.duration.toFixed(2)}s` : 'unknown',
      processingTime: `${processingTime}ms`
    });

    // Log audit event (without PHI)
    try {
      await supabase.from('ai_logs').insert({
        user_id: userId,
        operation_type: 'transcription',
        model: 'whisper-1',
        status: 'success',
        input_hash: transcriptHash,
        tokens_used: Math.ceil(audioFile.size / 100), // Estimate
        duration_ms: processingTime, // Actual processing duration in ms
      });
    } catch (logError) {
      console.error(`[${requestId}] Failed to log audit event:`, logError);
    }

    return new Response(
      JSON.stringify({ 
        text: result.text,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Transcription failed',
        success: false 
      }),
      {
        status: error instanceof Error && error.message.includes('Rate limit') ? 429 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});