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
  const audioQueue: string[] = []; // Buffer audio until connected

  clientSocket.onopen = () => {
    console.log('✅ Client WebSocket connected');

    // Connect to AssemblyAI streaming API with enhanced parameters for medical transcription
    const params = new URLSearchParams({
      sample_rate: '16000',
      encoding: 'pcm_s16le',
      word_boost: JSON.stringify([
        // Medical terms
        'diagnosis', 'prognosis', 'prescription', 'medication', 'treatment', 'symptoms', 'patient',
        'examination', 'laboratory', 'radiology', 'surgery', 'anesthesia', 'vital signs',
        // Common medications
        'aspirin', 'ibuprofen', 'paracetamol', 'amoxicillin', 'metformin', 'insulin',
        // Anatomy
        'heart', 'lung', 'liver', 'kidney', 'brain', 'spine', 'abdomen', 'thorax',
      ]),
      punctuate: 'true',
      format_text: 'true',
      disfluencies: 'false', // Remove filler words
      multichannel: 'false',
      language_code: 'en', // Multi-accent English support
    });
    
    const assemblyAIUrl = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}&token=${ASSEMBLYAI_API_KEY}`;
    
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

      // Process any queued audio data
      console.log(`📦 Processing ${audioQueue.length} queued audio chunks`);
      while (audioQueue.length > 0) {
        const audioData = audioQueue.shift();
        if (audioData && assemblyAISocket) {
          assemblyAISocket.send(JSON.stringify({ audio_data: audioData }));
        }
      }
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
    try {
      const data = JSON.parse(event.data);
      
      // Forward audio data to AssemblyAI
      if (data.type === 'audio' && data.audio) {
        if (!isConnected || !assemblyAISocket || assemblyAISocket.readyState !== WebSocket.OPEN) {
          // Queue audio if not connected yet
          audioQueue.push(data.audio);
          if (audioQueue.length % 10 === 0) {
            console.log(`📦 Queued ${audioQueue.length} audio chunks (waiting for connection)`);
          }
          return;
        }
        
        assemblyAISocket.send(JSON.stringify({
          audio_data: data.audio, // Base64 PCM16 audio
        }));
      } else if (data.type === 'terminate') {
        // Client requested termination
        if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
          assemblyAISocket.send(JSON.stringify({
            terminate_session: true,
          }));
        }
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
