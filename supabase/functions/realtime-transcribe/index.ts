import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    console.log('🔌 Client WebSocket connected');
    
    let openaiWs: WebSocket | null = null;

    socket.onopen = () => {
      console.log('✅ Client connected, opening OpenAI connection...');
      
      // Connect to OpenAI Realtime API
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      openaiWs = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${OPENAI_API_KEY}`,
        'openai-beta.realtime-v1'
      ]);

      openaiWs.onopen = () => {
        console.log('✅ Connected to OpenAI Realtime API');
      };

      openaiWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📥 OpenAI event:', data.type);

        // Configure session after receiving session.created
        if (data.type === 'session.created') {
          console.log('🔧 Configuring session...');
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: 'You are a medical transcription assistant. Transcribe the doctor-patient conversation accurately, focusing on medical terminology.',
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8
            }
          };
          openaiWs?.send(JSON.stringify(sessionConfig));
          console.log('✅ Session configured');
        }

        // Forward transcription events to client
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          console.log('📝 Transcription:', data.transcript);
          socket.send(JSON.stringify({
            type: 'transcription',
            text: data.transcript,
            isFinal: true
          }));
        }

        // Forward all events to client
        socket.send(event.data);
      };

      openaiWs.onerror = (error) => {
        console.error('❌ OpenAI WebSocket error:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'OpenAI connection error'
        }));
      };

      openaiWs.onclose = () => {
        console.log('🔌 OpenAI connection closed');
        socket.close();
      };
    };

    socket.onmessage = (event) => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        // Forward client messages to OpenAI
        openaiWs.send(event.data);
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client disconnected');
      if (openaiWs) {
        openaiWs.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (openaiWs) {
        openaiWs.close();
      }
    };

    return response;

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
