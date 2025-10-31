/**
 * AssemblyAI Real-Time Transcription Client
 * 
 * This class manages real-time speech-to-text transcription using AssemblyAI's WebSocket API.
 * It connects through a Supabase Edge Function for secure API key management.
 */

interface AssemblyAIConfig {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  sampleRate?: number;
}

interface AssemblyAIMessage {
  message_type: string;
  text?: string;
  confidence?: number;
  audio_start?: number;
  audio_end?: number;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class AssemblyAITranscription {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private config: AssemblyAIConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private projectId: string = 'atlszopzpkouueqefbbz'; // Supabase project ID

  constructor(config: AssemblyAIConfig = {}) {
    this.config = {
      sampleRate: 16000, // AssemblyAI requires 16kHz
      ...config,
    };
  }

  /**
   * Start real-time transcription
   */
  async start(): Promise<boolean> {
    try {
      console.log('🎙️ Starting AssemblyAI transcription...');

      // Connect to WebSocket through Edge Function
      await this.connectWebSocket();

      // Start audio capture
      await this.startAudioCapture();

      return true;
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.config.onError?.(`Failed to start: ${error.message}`);
      return false;
    }
  }

  /**
   * Connect to AssemblyAI through Supabase Edge Function
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect through Supabase Edge Function
        const wsUrl = `wss://${this.projectId}.supabase.co/functions/v1/assemblyai-realtime`;
        console.log('🔌 Connecting to:', wsUrl);
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.config.onConnectionChange?.(true);
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.config.onError?.('Connection error');
          reject(error);
        };

        this.socket.onclose = () => {
          console.log('🔌 WebSocket closed');
          this.isConnected = false;
          this.config.onConnectionChange?.(false);
          this.handleReconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: AssemblyAIMessage = JSON.parse(data);
      
      switch (message.message_type) {
        case 'SessionBegins':
          console.log('✅ AssemblyAI session started');
          break;

        case 'PartialTranscript':
          if (message.text) {
            console.log('📝 Partial:', message.text);
            this.config.onTranscript?.(message.text, false);
          }
          break;

        case 'FinalTranscript':
          if (message.text) {
            console.log('✅ Final:', message.text, `(confidence: ${(message.confidence || 0) * 100}%)`);
            this.config.onTranscript?.(message.text, true);
          }
          break;

        case 'SessionTerminated':
          console.log('🔌 Session terminated');
          this.stop();
          break;

        default:
          console.log('📨 Message:', message.message_type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Start capturing audio from microphone
   */
  private async startAudioCapture(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });

      // Create audio source
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor for audio chunks
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isConnected || !this.socket) return;

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16)
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer);

        // Send to AssemblyAI
        this.socket.send(JSON.stringify({
          type: 'audio',
          audio_data: base64Audio,
        }));
      };

      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('✅ Audio capture started');
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.config.onError?.('Failed to access microphone');
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.config.onError?.('Connection lost. Please restart transcription.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Stop transcription and clean up
   */
  stop(): void {
    console.log('🛑 Stopping AssemblyAI transcription...');

    // Send termination message
    if (this.socket && this.isConnected) {
      try {
        this.socket.send(JSON.stringify({ type: 'terminate' }));
      } catch (error) {
        console.error('Error sending termination:', error);
      }
    }

    // Clean up audio
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
    this.config.onConnectionChange?.(false);
    console.log('✅ Transcription stopped');
  }

  /**
   * Check if transcription is active
   */
  isActive(): boolean {
    return this.isConnected && this.socket !== null;
  }
}
