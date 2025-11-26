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

  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get model from query params (default to nova-2)
  const url = new URL(req.url);
  const model = url.searchParams.get('model') || 'nova-2';

  console.log(`🎙️ Initializing Deepgram real-time streaming with model: ${model}...`);

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let deepgramSocket: WebSocket | null = null;
  let isConnected = false;
  let heartbeatInterval: number | null = null;

  clientSocket.onopen = () => {
    console.log('✅ Client WebSocket connected');

    // Connect to Deepgram streaming API
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=${model}&punctuate=true&smart_format=true&interim_results=true&endpointing=300&encoding=linear16&sample_rate=16000&channels=1`;
    
    deepgramSocket = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    deepgramSocket.onopen = () => {
      console.log(`✅ Connected to Deepgram streaming (${model})`);
      isConnected = true;
      
      // Send connection success to client
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: `Deepgram ${model} active`,
        model: model,
      }));

      // Start heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 10000); // Every 10 seconds
    };

    deepgramSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Forward Deepgram events to client
        if (data.type === 'Results') {
          const channel = data.channel?.alternatives?.[0];
          if (!channel) return;

          const transcript = channel.transcript;
          const confidence = channel.confidence || 0;
          const isFinal = data.is_final || false;

          if (transcript && transcript.trim().length > 0) {
            clientSocket.send(JSON.stringify({
              type: isFinal ? 'final' : 'partial',
              text: transcript,
              confidence: confidence,
              words: channel.words || [],
            }));
          }
        } else if (data.type === 'Metadata') {
          console.log('✅ Deepgram metadata:', data);
          clientSocket.send(JSON.stringify({
            type: 'session_started',
            request_id: data.request_id,
          }));
        }
      } catch (error) {
        console.error('❌ Error processing Deepgram message:', error);
      }
    };

    deepgramSocket.onerror = (error) => {
      console.error('❌ Deepgram WebSocket error:', error);
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'Deepgram connection error',
      }));
    };

    deepgramSocket.onclose = () => {
      console.log('🛑 Deepgram WebSocket closed');
      isConnected = false;
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'disconnected',
      }));
    };
  };

  clientSocket.onmessage = (event) => {
    if (!isConnected || !deepgramSocket) {
      console.warn('⚠️ Received audio before Deepgram connection ready');
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      // Forward audio data to Deepgram (expects raw binary audio data)
      if (data.type === 'audio' && data.audio) {
        // Convert base64 to binary
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        deepgramSocket.send(bytes);
      } else if (data.type === 'terminate') {
        // Client requested termination
        deepgramSocket.close();
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
    
    // Clean up heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  };

  return response;
});
