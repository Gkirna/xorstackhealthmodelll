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

    // Connect to OpenAI Realtime API
    const openAIUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
    
    openAISocket = new WebSocket(openAIUrl, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    openAISocket.onopen = () => {
      console.log(`✅ Connected to OpenAI Realtime (${model})`);
      isConnected = true;
      
      // Send connection success to client
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: `OpenAI Realtime ${vadType} active`,
        model: model,
      }));
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Session created - now configure it
        if (data.type === 'session.created' && !sessionCreated) {
          sessionCreated = true;
          console.log('✅ OpenAI session created, sending configuration...');
          
          // Configure session with VAD settings
          const sessionConfig: any = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: 'You are a medical transcription assistant. Transcribe medical conversations accurately with proper medical terminology.',
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: vadType,
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8,
              max_response_output_tokens: 'inf'
            }
          };

          openAISocket?.send(JSON.stringify(sessionConfig));
        }
        
        // Forward transcription results to client
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = data.transcript || '';
          if (transcript.trim().length > 0) {
            clientSocket.send(JSON.stringify({
              type: 'final',
              text: transcript,
              confidence: 0.95,
            }));
          }
        } else if (data.type === 'input_audio_buffer.speech_started') {
          clientSocket.send(JSON.stringify({
            type: 'speech_started',
          }));
        } else if (data.type === 'input_audio_buffer.speech_stopped') {
          clientSocket.send(JSON.stringify({
            type: 'speech_stopped',
          }));
        } else if (data.type === 'response.audio_transcript.delta') {
          // Partial transcript
          const delta = data.delta || '';
          if (delta.trim().length > 0) {
            clientSocket.send(JSON.stringify({
              type: 'partial',
              text: delta,
              confidence: 0.9,
            }));
          }
        } else if (data.type === 'error') {
          console.error('❌ OpenAI error:', data.error);
          clientSocket.send(JSON.stringify({
            type: 'error',
            message: data.error?.message || 'OpenAI error',
          }));
        }
        
        // Forward all events to client for debugging
        clientSocket.send(JSON.stringify({
          type: 'openai_event',
          event: data,
        }));
      } catch (error) {
        console.error('❌ Error processing OpenAI message:', error);
      }
    };

    openAISocket.onerror = (error) => {
      console.error('❌ OpenAI WebSocket error:', error);
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI connection error',
      }));
    };

    openAISocket.onclose = () => {
      console.log('🛑 OpenAI WebSocket closed');
      isConnected = false;
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'disconnected',
      }));
    };
  };

  clientSocket.onmessage = (event) => {
    if (!isConnected || !openAISocket) {
      console.warn('⚠️ Received audio before OpenAI connection ready');
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      // Forward audio data to OpenAI (expects base64 PCM16)
      if (data.type === 'audio' && data.audio) {
        openAISocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: data.audio, // Base64 PCM16 audio
        }));
      } else if (data.type === 'commit') {
        // Manually commit audio buffer
        openAISocket.send(JSON.stringify({
          type: 'input_audio_buffer.commit',
        }));
      } else if (data.type === 'terminate') {
        // Client requested termination
        openAISocket.close();
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
    
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  return response;
});
