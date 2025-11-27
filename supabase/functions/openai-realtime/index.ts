import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get model from query params
  const url = new URL(req.url);
  const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-12-17';
  const vadType = url.searchParams.get('vad') || 'server_vad';

  console.log(`🎙️ Initializing OpenAI Realtime with model: ${model}, VAD: ${vadType}...`);

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let openAISocket: WebSocket | null = null;
  let isConnected = false;
  let sessionCreated = false;

  clientSocket.onopen = () => {
    console.log('✅ Client WebSocket connected');

    // IMPORTANT: Deno WebSocket doesn't support custom headers in constructor
    // OpenAI Realtime API requires Authorization header, which cannot be passed in Deno runtime
    // This is a known limitation - OpenAI Realtime is not currently supported
    // Use AssemblyAI or Deepgram for real-time transcription instead
    
    console.warn('⚠️ OpenAI Realtime is not supported in Deno edge functions due to header limitations');
    console.warn('⚠️ Please use AssemblyAI (assemblyai-nano) or Deepgram (nova-2-medical) instead');
    
    clientSocket.send(JSON.stringify({
      type: 'error',
      message: 'OpenAI Realtime API is not supported in this environment. Please use AssemblyAI or Deepgram for real-time transcription.',
    }));
  };

  clientSocket.onmessage = (event) => {
    // OpenAI Realtime not supported - ignore messages
  };

  clientSocket.onerror = (error) => {
    console.error('❌ Client WebSocket error:', error);
  };

  clientSocket.onclose = () => {
    console.log('🛑 Client WebSocket closed');
  };

  return response;
});
