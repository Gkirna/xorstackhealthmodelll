import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      headers: corsHeaders 
    });
  }

  const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
  if (!ASSEMBLYAI_API_KEY) {
    console.error("ASSEMBLYAI_API_KEY not configured");
    return new Response("API key not configured", { 
      status: 500,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔌 Establishing WebSocket connection to AssemblyAI...');
    
    // Get temporary token from AssemblyAI
    const tokenResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Failed to get AssemblyAI token:', error);
      return new Response(`Failed to authenticate: ${error}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const { token } = await tokenResponse.json();
    console.log('✅ AssemblyAI token obtained');

    // Upgrade client connection
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to AssemblyAI
    const assemblyAISocket = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );

    console.log('🔗 Connecting to AssemblyAI WebSocket...');

    assemblyAISocket.onopen = () => {
      console.log('✅ Connected to AssemblyAI');
      clientSocket.send(JSON.stringify({ 
        type: 'connection_established',
        message: 'Connected to AssemblyAI real-time transcription' 
      }));
    };

    assemblyAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Forward all messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }

        // Log transcription results
        if (data.message_type === 'FinalTranscript') {
          console.log('📝 Final:', data.text);
        } else if (data.message_type === 'PartialTranscript') {
          console.log('⏳ Partial:', data.text?.substring(0, 50));
        }
      } catch (error) {
        console.error('Error processing AssemblyAI message:', error);
      }
    };

    assemblyAISocket.onerror = (error) => {
      console.error('❌ AssemblyAI WebSocket error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ 
          type: 'error',
          message: 'AssemblyAI connection error' 
        }));
      }
    };

    assemblyAISocket.onclose = () => {
      console.log('🔌 AssemblyAI connection closed');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    // Handle client messages (audio data)
    clientSocket.onmessage = (event) => {
      // Forward audio data to AssemblyAI
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        assemblyAISocket.send(event.data);
      }
    };

    clientSocket.onclose = () => {
      console.log('👋 Client disconnected');
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        // Send terminate message to AssemblyAI
        assemblyAISocket.send(JSON.stringify({ terminate_session: true }));
        assemblyAISocket.close();
      }
    };

    clientSocket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        assemblyAISocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error('❌ WebSocket setup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`WebSocket setup failed: ${errorMessage}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
