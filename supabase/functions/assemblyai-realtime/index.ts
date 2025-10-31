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
    
    // Upgrade client connection first
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to AssemblyAI Universal Streaming - send API key in first message
    const assemblyAISocket = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws');

    console.log('🔗 Connecting to AssemblyAI WebSocket...');

    let sessionConfigured = false;

    assemblyAISocket.onopen = () => {
      console.log('✅ Connected to AssemblyAI, sending configuration...');
      
      // Send configuration with API key and audio settings
      assemblyAISocket.send(JSON.stringify({
        audio_encoding: 'pcm_s16le',
        sample_rate: 16000,
        word_boost: ['medical', 'doctor', 'patient', 'diagnosis', 'treatment'],
        token: ASSEMBLYAI_API_KEY
      }));
      
      console.log('📤 Configuration sent, waiting for SessionBegins...');
    };

    assemblyAISocket.onmessage = (event) => {
      try {
        console.log('📨 Received from AssemblyAI:', event.data);
        const data = JSON.parse(event.data);
        
        // Handle SessionBegins - notify client that connection is ready
        if (data.message_type === 'SessionBegins') {
          console.log('🎙️ Session started - notifying client');
          sessionConfigured = true;
          
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ 
              type: 'connection_established',
              message: 'Connected to AssemblyAI real-time transcription' 
            }));
          }
        }
        
        // Handle errors
        if (data.error) {
          console.error('❌ AssemblyAI error:', data.error);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ 
              type: 'error',
              message: data.error 
            }));
          }
        }
        
        // Forward all messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }

        // Log transcription results for debugging
        if (data.message_type === 'FinalTranscript') {
          console.log('📝 Final:', data.text?.substring(0, 100));
        } else if (data.message_type === 'PartialTranscript') {
          console.log('⏳ Partial:', data.text?.substring(0, 50));
        } else if (data.message_type === 'SessionInformation') {
          console.log('ℹ️ Session info:', JSON.stringify(data));
        }
      } catch (error) {
        console.error('Error processing AssemblyAI message:', error, 'Raw data:', event.data);
      }
    };

    assemblyAISocket.onerror = (error) => {
      console.error('❌ AssemblyAI WebSocket error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ 
          type: 'error',
          message: 'AssemblyAI connection error' 
        }));
      }
    };

    assemblyAISocket.onclose = (event) => {
      console.log('🔌 AssemblyAI connection closed. Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    // Handle client messages (audio data - expecting base64 strings)
    clientSocket.onmessage = (event) => {
      // Forward audio data to AssemblyAI (Universal Streaming expects raw base64)
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        assemblyAISocket.send(event.data);
      }
    };

    clientSocket.onclose = () => {
      console.log('👋 Client disconnected');
      if (assemblyAISocket.readyState === WebSocket.OPEN) {
        // Universal Streaming: just close the connection
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
