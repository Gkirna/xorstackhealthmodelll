/**
 * OpenAI Realtime API Transcription
 * Uses WebSocket for continuous, real-time audio transcription
 */

export interface RealtimeTranscriptionConfig {
  language?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('✅ AudioRecorder started at 24kHz');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('🛑 AudioRecorder stopped');
  }
}

export class RealtimeTranscription {
  private config: RealtimeTranscriptionConfig;
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private isActive: boolean = false;
  private fullTranscript: string = '';

  constructor(config: RealtimeTranscriptionConfig = {}) {
    this.config = {
      language: 'en',
      ...config
    };
  }

  private encodeAudioForAPI(float32Array: Float32Array): string {
    // Convert Float32 to Int16 PCM
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to Uint8Array and base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  async start(stream: MediaStream): Promise<boolean> {
    if (this.isActive) {
      console.warn('⚠️ Realtime transcription already active');
      return false;
    }

    try {
      console.log('🎙️ Starting Realtime transcription');

      // Get Supabase project URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not found');
      }

      // Connect to WebSocket edge function
      const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/functions/v1/realtime-transcribe';
      console.log('🔌 Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isActive = true;

        if (this.config.onStart) {
          this.config.onStart();
        }

        // Start audio recording
        this.recorder = new AudioRecorder((audioData) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const encoded = this.encodeAudioForAPI(audioData);
            this.ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: encoded
            }));
          }
        });
        
        this.recorder.start();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Received:', data.type);

          if (data.type === 'transcription') {
            const transcriptText = data.text?.trim();
            if (transcriptText && transcriptText.length > 0) {
              console.log('📝 Transcription:', transcriptText);
              this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcriptText;
              
              if (this.config.onResult) {
                this.config.onResult(transcriptText, data.isFinal);
              }
            }
          } else if (data.type === 'error') {
            console.error('❌ Server error:', data.message);
            if (this.config.onError) {
              this.config.onError(data.message);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        if (this.config.onError) {
          this.config.onError('WebSocket connection error');
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        this.isActive = false;
        if (this.config.onEnd) {
          this.config.onEnd();
        }
      };

      return true;

    } catch (error) {
      console.error('❌ Failed to start Realtime transcription:', error);
      if (this.config.onError) {
        this.config.onError('Failed to start transcription');
      }
      return false;
    }
  }

  public stop(): string {
    console.log('🛑 Stopping Realtime transcription');

    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isActive = false;

    if (this.config.onEnd) {
      this.config.onEnd();
    }

    return this.fullTranscript;
  }

  public pause() {
    // Not supported in Realtime API - would need to stop sending audio
    console.log('⏸️ Pause not supported in Realtime API');
  }

  public resume() {
    // Not supported in Realtime API
    console.log('▶️ Resume not supported in Realtime API');
  }

  public isTranscribing(): boolean {
    return this.isActive;
  }

  public getFullTranscript(): string {
    return this.fullTranscript;
  }

  public destroy() {
    this.stop();
    this.fullTranscript = '';
  }
}
