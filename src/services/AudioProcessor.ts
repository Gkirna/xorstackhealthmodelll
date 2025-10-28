/**
 * Enhanced Audio Processor for ASR Services
 * Handles audio streaming and processing for professional ASR
 */

export interface AudioProcessorConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
}

export class AudioProcessor {
  private config: AudioProcessorConfig;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isProcessing = false;
  private stream: MediaStream | null = null;

  constructor(config: AudioProcessorConfig = {
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    chunkSize: 4096
  }) {
    this.config = config;
  }

  public async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      console.log('✅ Audio context initialized:', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      return false;
    }
  }

  public async startProcessing(stream: MediaStream, onAudioData: (data: ArrayBuffer) => void): Promise<boolean> {
    if (!this.audioContext) {
      console.error('Audio context not initialized');
      return false;
    }

    try {
      this.stream = stream;
      
      // Create source node from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Create processor node for audio processing
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.chunkSize,
        this.config.channels,
        this.config.channels
      );

      // Set up audio processing
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isProcessing) return;

        const inputBuffer = event.inputBuffer;
        const audioData = this.convertToPCM(inputBuffer);
        
        if (audioData.byteLength > 0) {
          onAudioData(audioData);
        }
      };

      // Connect the audio nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isProcessing = true;
      console.log('✅ Audio processing started');

      return true;
    } catch (error) {
      console.error('❌ Failed to start audio processing:', error);
      return false;
    }
  }

  public stopProcessing(): void {
    this.isProcessing = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    console.log('🛑 Audio processing stopped');
  }

  private convertToPCM(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const arrayBuffer = new ArrayBuffer(length * 2); // 16-bit samples
    const view = new DataView(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0); // Mono channel
    
    for (let i = 0; i < length; i++) {
      // Convert float32 to int16
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = Math.round(sample * 32767);
      view.setInt16(i * 2, intSample, true); // Little-endian
    }

    return arrayBuffer;
  }

  public destroy(): void {
    this.stopProcessing();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  public isActive(): boolean {
    return this.isProcessing && this.audioContext?.state === 'running';
  }
}
