import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 426,
      headers: corsHeaders 
    });
  }

  const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!ASSEMBLYAI_API_KEY) {
    console.error('❌ ASSEMBLYAI_API_KEY not configured');
    return new Response("AssemblyAI API key not configured", { 
      status: 500,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🎙️ Setting up AssemblyAI WebSocket connection...');

    // Upgrade client connection to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to AssemblyAI
    const assemblyAIUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`;
    const assemblyAISocket = new WebSocket(assemblyAIUrl, {
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
      }
    });

    // Forward messages from client to AssemblyAI
    clientSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'audio') {
          // Forward audio data to AssemblyAI
          assemblyAISocket.send(JSON.stringify({
            audio_data: data.audio_data
          }));
        } else if (data.type === 'terminate') {
          // Close AssemblyAI connection
          assemblyAISocket.send(JSON.stringify({ terminate_session: true }));
          assemblyAISocket.close();
          clientSocket.close();
        }
      } catch (error) {
        console.error('Error processing client message:', error);
      }
    };

    // Forward messages from AssemblyAI to client
    assemblyAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 AssemblyAI message:', data.message_type);
        
        // Forward all AssemblyAI messages to client
        clientSocket.send(JSON.stringify(data));
      } catch (error) {
        console.error('Error processing AssemblyAI message:', error);
      }
    };

    // Handle AssemblyAI connection open
    assemblyAISocket.onopen = () => {
      console.log('✅ Connected to AssemblyAI');
      clientSocket.send(JSON.stringify({ 
        type: 'connection', 
        status: 'connected' 
      }));
    };

    // Handle AssemblyAI errors
    assemblyAISocket.onerror = (error) => {
      console.error('❌ AssemblyAI error:', error);
      clientSocket.send(JSON.stringify({ 
        type: 'error', 
        message: 'AssemblyAI connection error' 
      }));
    };

    // Handle AssemblyAI close
    assemblyAISocket.onclose = () => {
      console.log('🔌 AssemblyAI connection closed');
      clientSocket.send(JSON.stringify({ 
        type: 'connection', 
        status: 'closed' 
      }));
      clientSocket.close();
    };

    // Handle client close
    clientSocket.onclose = () => {
      console.log('🔌 Client connection closed');
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        assemblyAISocket.send(JSON.stringify({ terminate_session: true }));
        assemblyAISocket.close();
      }
    };

    // Handle client errors
    clientSocket.onerror = (error) => {
      console.error('❌ Client error:', error);
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        assemblyAISocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error('❌ Error setting up WebSocket:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
