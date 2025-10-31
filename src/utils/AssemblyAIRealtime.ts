/**
 * AssemblyAI Real-time Transcription Client
 * Connects to AssemblyAI via edge function WebSocket proxy
 */

interface AssemblyAIOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  continuous?: boolean;
}

interface AssemblyAIMessage {
  message_type?: 'SessionBegins' | 'PartialTranscript' | 'FinalTranscript' | 'SessionTerminated' | 'SessionInformation';
  type?: string;
  text?: string;
  confidence?: number;
  audio_start?: number;
  audio_end?: number;
  error?: string;
  message?: string;
}

export class AssemblyAIRealtime {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: number | null = null;

  constructor(private options: AssemblyAIOptions) {}

  /**
   * Initialize connection to AssemblyAI via edge function
   */
  async connect(): Promise<boolean> {
    try {
      const wsUrl = import.meta.env.VITE_SUPABASE_URL.replace('https://', 'wss://');
      const socketUrl = `${wsUrl}/functions/v1/assemblyai-realtime`;
      
      console.log('🔌 Connecting to AssemblyAI via:', socketUrl);
      
      this.socket = new WebSocket(socketUrl);

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }

        const timeout = setTimeout(() => {
          console.error('⏱️ Connection timeout after 15s');
          this.options.onError('Connection timeout - please check your network');
          reject(new Error('Connection timeout'));
          this.socket?.close();
        }, 15000); // Increased to 15s

        this.socket.onopen = () => {
          console.log('✅ WebSocket connection opened');
        };

        this.socket.onmessage = (event) => {
          try {
            const data: AssemblyAIMessage = JSON.parse(event.data);
            
            if (data.type === 'connection_established') {
              console.log('✅ Connected to AssemblyAI successfully');
              this.isConnected = true;
              this.reconnectAttempts = 0;
              this.options.onConnect?.();
              clearTimeout(timeout);
              resolve(true);
              return;
            }

            // Handle Universal Streaming API message types
            if (data.message_type === 'SessionBegins') {
              console.log('🎙️ AssemblyAI session started');
              return;
            }

            if (data.message_type === 'PartialTranscript' && data.text) {
              this.options.onTranscript(data.text, false);
            }

            if (data.message_type === 'FinalTranscript' && data.text) {
              console.log('📝 Final transcript:', data.text.substring(0, 100));
              this.options.onTranscript(data.text, true);
            }

            if (data.message_type === 'SessionTerminated') {
              console.log('🔌 AssemblyAI session terminated');
            }
            
            // Handle error messages
            if (data.message_type === 'SessionInformation' && data.error) {
              console.error('❌ AssemblyAI error:', data.error);
              this.options.onError(data.error);
              clearTimeout(timeout);
              reject(new Error(data.error));
            }
            
            // Handle connection errors
            if (data.type === 'error') {
              console.error('❌ Connection error:', data.message);
              this.options.onError(data.message || 'Connection error');
              clearTimeout(timeout);
              reject(new Error(data.message || 'Connection error'));
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          clearTimeout(timeout);
          this.options.onError('WebSocket connection failed');
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.cleanup();
          this.options.onDisconnect?.();
          
          // Auto-reconnect if continuous mode and not manually closed
          if (this.options.continuous && this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1000) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.reconnectTimeout = window.setTimeout(() => {
              this.connect();
            }, 2000 * this.reconnectAttempts);
          }
        };
      });
    } catch (error) {
      console.error('Connection error:', error);
      this.options.onError(error instanceof Error ? error.message : 'Connection failed');
      return false;
    }
  }

  /**
   * Start capturing and sending audio
   */
  async startAudio(stream: MediaStream): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to AssemblyAI');
      }

      console.log('🎤 Starting audio capture...');
      this.stream = stream;

      // Create audio context with 16kHz sample rate (required by AssemblyAI)
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(stream);

      // Create processor for audio data
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16 little-endian for Universal Streaming)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64 and send (Universal Streaming uses base64 PCM)
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        try {
          // Send audio data - Universal Streaming expects just base64 string, not wrapped in object
          this.socket!.send(base64Audio);
        } catch (error) {
          console.error('Error sending audio:', error);
        }
      };

      // Connect nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('✅ Audio streaming started');
      return true;
    } catch (error) {
      console.error('Error starting audio:', error);
      this.options.onError(error instanceof Error ? error.message : 'Failed to start audio');
      return false;
    }
  }

  /**
   * Stop audio capture and close connection
   */
  disconnect(): void {
    console.log('🛑 Disconnecting from AssemblyAI...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Universal Streaming: just close the connection, no termination message needed
      this.socket.close();
    }

    this.cleanup();
  }

  private cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isConnected = false;
    this.socket = null;
  }

  /**
   * Check if currently connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }
}
