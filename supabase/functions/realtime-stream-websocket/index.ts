import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

serve(async (req) => {
  // Only accept WebSocket upgrade requests
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let deepgramSocket: WebSocket | null = null;
  let isDeepgramConnected = false;

  socket.onopen = () => {
    console.log("✅ Client WebSocket connected");
    
    // Connect to Deepgram's streaming API
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?` + new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      diarize: 'true',
      punctuate: 'true',
      utterances: 'true',
      language: 'en-US',
      encoding: 'linear16',
      sample_rate: '24000',
      channels: '1',
      interim_results: 'true',
    });

    deepgramSocket = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    deepgramSocket.onopen = () => {
      console.log("✅ Deepgram WebSocket connected");
      isDeepgramConnected = true;
      socket.send(JSON.stringify({ 
        type: 'connection', 
        status: 'connected',
        message: 'Ready to receive audio'
      }));
    };

    deepgramSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 Deepgram message:", data.type);
        
        // Forward Deepgram responses to client
        if (data.type === 'Results') {
          const channel = data.channel;
          const alternatives = channel?.alternatives?.[0];
          
          if (alternatives && alternatives.transcript) {
            const isFinal = data.is_final || false;
            const transcript = alternatives.transcript;
            const confidence = alternatives.confidence || 0;
            const words = alternatives.words || [];
            
            console.log(`📝 ${isFinal ? 'Final' : 'Interim'}: "${transcript}"`);
            
            socket.send(JSON.stringify({
              type: isFinal ? 'transcript_final' : 'transcript_interim',
              text: transcript,
              confidence,
              words,
              is_final: isFinal,
              speaker: data.channel?.speaker,
            }));
          }
        } else if (data.type === 'UtteranceEnd') {
          console.log("🎤 Utterance ended");
          socket.send(JSON.stringify({
            type: 'utterance_end',
          }));
        } else if (data.type === 'Metadata') {
          console.log("📊 Metadata:", data);
          socket.send(JSON.stringify({
            type: 'metadata',
            data: data,
          }));
        }
      } catch (error) {
        console.error("❌ Error processing Deepgram message:", error);
      }
    };

    deepgramSocket.onerror = (error) => {
      console.error("❌ Deepgram WebSocket error:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Deepgram connection error',
      }));
    };

    deepgramSocket.onclose = () => {
      console.log("🔌 Deepgram WebSocket closed");
      isDeepgramConnected = false;
      socket.send(JSON.stringify({
        type: 'connection',
        status: 'disconnected',
      }));
    };
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'audio' && isDeepgramConnected && deepgramSocket) {
        // Forward audio data to Deepgram
        // Audio should be base64-encoded PCM16 at 24kHz
        const audioData = message.audio;
        
        // Decode base64 to binary
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Send binary audio to Deepgram
        deepgramSocket.send(bytes);
      } else if (message.type === 'stop') {
        console.log("⏹️ Stop command received");
        if (deepgramSocket && isDeepgramConnected) {
          // Send close frame to Deepgram to get final results
          deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
        }
      }
    } catch (error) {
      console.error("❌ Error processing client message:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Client WebSocket closed");
    if (deepgramSocket) {
      deepgramSocket.close();
    }
  };

  socket.onerror = (error) => {
    console.error("❌ Client WebSocket error:", error);
    if (deepgramSocket) {
      deepgramSocket.close();
    }
  };

  return response;
});
