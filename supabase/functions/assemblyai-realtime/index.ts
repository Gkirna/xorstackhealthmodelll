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

  const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!ASSEMBLYAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not configured' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  console.log('🎙️ Initializing AssemblyAI real-time streaming...');

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let assemblyAISocket: WebSocket | null = null;
  let isConnected = false;

  clientSocket.onopen = () => {
    console.log('✅ Client WebSocket connected');

    // Connect to AssemblyAI streaming API
    const assemblyAIUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&formatted_finals=true&token=${ASSEMBLYAI_API_KEY}`;
    
    assemblyAISocket = new WebSocket(assemblyAIUrl);

    assemblyAISocket.onopen = () => {
      console.log('✅ Connected to AssemblyAI streaming');
      isConnected = true;
      
      // Send connection success to client
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: 'High Accuracy Mode active',
      }));
    };

    assemblyAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Forward AssemblyAI events to client
        if (data.message_type === 'PartialTranscript') {
          clientSocket.send(JSON.stringify({
            type: 'partial',
            text: data.text,
            confidence: data.confidence,
          }));
        } else if (data.message_type === 'FinalTranscript') {
          clientSocket.send(JSON.stringify({
            type: 'final',
            text: data.text,
            confidence: data.confidence,
            words: data.words || [],
          }));
        } else if (data.message_type === 'SessionBegins') {
          console.log('✅ AssemblyAI session started:', data.session_id);
          clientSocket.send(JSON.stringify({
            type: 'session_started',
            session_id: data.session_id,
          }));
        } else if (data.message_type === 'SessionTerminated') {
          console.log('🛑 AssemblyAI session terminated');
          clientSocket.send(JSON.stringify({
            type: 'session_ended',
          }));
        }
      } catch (error) {
        console.error('❌ Error processing AssemblyAI message:', error);
      }
    };

    assemblyAISocket.onerror = (error) => {
      console.error('❌ AssemblyAI WebSocket error:', error);
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'AssemblyAI connection error',
      }));
    };

    assemblyAISocket.onclose = () => {
      console.log('🛑 AssemblyAI WebSocket closed');
      isConnected = false;
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'disconnected',
      }));
    };
  };

  clientSocket.onmessage = (event) => {
    if (!isConnected || !assemblyAISocket) {
      console.warn('⚠️ Received audio before AssemblyAI connection ready');
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      // Forward audio data to AssemblyAI
      if (data.type === 'audio' && data.audio) {
        assemblyAISocket.send(JSON.stringify({
          audio_data: data.audio, // Base64 PCM16 audio
        }));
      } else if (data.type === 'terminate') {
        // Client requested termination
        assemblyAISocket.send(JSON.stringify({
          terminate_session: true,
        }));
      }
    } catch (error) {
      console.error('❌ Error processing client message:', error);
    }
  };

  clientSocket.onerror = (error) => {
    console.error('❌ Client WebSocket error:', error);
  };

  clientSocket.onclose = () => {
    console.log('🛑 Client WebSocket closed');
    if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
      assemblyAISocket.send(JSON.stringify({
        terminate_session: true,
      }));
      assemblyAISocket.close();
    }
  };

  return response;
});
