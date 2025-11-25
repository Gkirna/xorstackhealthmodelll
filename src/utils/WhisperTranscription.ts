/**
 * Advanced Real-Time Speech-to-Text using OpenAI Whisper
 * Provides superior accuracy for medical terminology and multi-accent support
 */

import { supabase } from "@/integrations/supabase/client";

export interface WhisperTranscriptionConfig {
  language?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  mode?: 'direct' | 'playback';
}

export class WhisperTranscription {
  private config: WhisperTranscriptionConfig;
  private isActive: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private chunkTimer: number | null = null;
  private processingQueue: Promise<void> = Promise.resolve();
  private fullTranscript: string = '';
  private chunkInterval: number = 3000; // Send chunks every 3 seconds

  constructor(config: WhisperTranscriptionConfig = {}) {
    this.config = {
      language: 'en',
      mode: 'direct',
      ...config
    };
  }

  async start(stream: MediaStream): Promise<boolean> {
    if (this.isActive) {
      console.warn('⚠️ Whisper transcription already active');
      return false;
    }

    try {
      console.log('🎙️ Starting Whisper transcription');
      console.log('📊 Mode:', this.config.mode);
      console.log('🌐 Language:', this.config.language);

      // Create MediaRecorder for audio chunks with timeslice for valid chunks
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      
      console.log('🎬 Using MIME type:', mimeType);
      const options = { mimeType };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📦 Audio chunk collected: ${event.data.size} bytes (Total chunks: ${this.audioChunks.length})`);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        if (this.config.onError) {
          this.config.onError('Recording error occurred');
        }
      };

      // Start recording with timeslice to get complete valid chunks every 3 seconds
      this.mediaRecorder.start(3000); // Request complete chunks every 3 seconds
      this.isActive = true;

      // Start periodic chunk processing every 3 seconds
      this.startChunkProcessing();

      if (this.config.onStart) {
        this.config.onStart();
      }

      console.log('✅ Whisper transcription started');
      return true;

    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      if (this.config.onError) {
        this.config.onError('Failed to start transcription');
      }
      return false;
    }
  }

  private startChunkProcessing() {
    console.log('⏰ Starting chunk processing timer: every 3 seconds');
    // Process accumulated audio every 3 seconds
    this.chunkTimer = window.setInterval(() => {
      this.processAccumulatedAudio();
    }, this.chunkInterval);
  }

  private async convertBlobToWav(blob: Blob): Promise<Blob> {
    // Convert WebM to WAV using Web Audio API
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 24000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get PCM data
    const pcmData = audioBuffer.getChannelData(0);
    const wavBuffer = this.encodeWav(pcmData, audioBuffer.sampleRate);
    
    await audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Convert float to int16
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  private async processAccumulatedAudio() {
    if (this.audioChunks.length === 0) {
      console.log('⏭️ No audio chunks to process yet');
      return;
    }

    console.log(`🔄 Processing batch: ${this.audioChunks.length} chunks accumulated`);
    
    // Get all accumulated chunks
    const chunksToProcess = [...this.audioChunks];
    this.audioChunks = []; // Clear for next batch

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        console.log(`🔄 Processing ${chunksToProcess.length} audio chunks`);
        
        // Each chunk from MediaRecorder is a complete valid blob with headers
        // Just take the first chunk which is a complete valid WebM file
        const audioBlob = chunksToProcess[0]; 
        console.log(`📊 Processing WebM blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

        // Skip if too small (less than 5KB - likely silence or incomplete)
        if (audioBlob.size < 5000) {
          console.log('⏭️ Skipping small audio chunk (likely silence)');
          return;
        }

        // Send audio blob directly to edge function (not base64)
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', this.config.language || 'en');

        // Send to Whisper API via edge function
        const { data, error } = await supabase.functions.invoke('whisper-transcribe', {
          body: formData
        });

        if (error) {
          console.error('❌ Transcription error:', error);
          if (this.config.onError) {
            this.config.onError('Transcription failed: ' + error.message);
          }
          return;
        }

        if (data?.success && data?.text) {
          const transcriptText = data.text.trim();
          
          if (transcriptText.length > 0) {
            console.log('✅ Transcription received:', transcriptText.substring(0, 50));
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcriptText;

            // Emit as final result (Whisper always returns final transcripts)
            if (this.config.onResult) {
              this.config.onResult(transcriptText, true);
            }
          } else {
            console.log('⏭️ Empty transcript received');
          }
        }

      } catch (error) {
        console.error('❌ Error processing audio chunk:', error);
        if (this.config.onError) {
          this.config.onError('Error processing audio');
        }
      }
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (data:audio/webm;base64,)
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public stop(): string {
    console.log('🛑 Stopping Whisper transcription');

    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    // Process any remaining chunks
    if (this.audioChunks.length > 0) {
      console.log('🔄 Processing final audio chunks');
      this.processAccumulatedAudio();
    }

    this.isActive = false;

    if (this.config.onEnd) {
      this.config.onEnd();
    }

    return this.fullTranscript;
  }

  public pause() {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
    console.log('⏸️ Whisper transcription paused');
  }

  public resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.startChunkProcessing();
      console.log('▶️ Whisper transcription resumed');
    }
  }

  public isTranscribing(): boolean {
    return this.isActive;
  }

  public getFullTranscript(): string {
    return this.fullTranscript;
  }

  public destroy() {
    this.stop();
    this.audioChunks = [];
    this.fullTranscript = '';
  }
}
