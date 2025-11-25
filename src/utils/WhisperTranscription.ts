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

      // Create MediaRecorder for audio chunks
      const options = { mimeType: 'audio/webm;codecs=opus' };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📦 Audio chunk collected: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        if (this.config.onError) {
          this.config.onError('Recording error occurred');
        }
      };

      // Start recording and collect chunks every second
      // The timeslice parameter tells MediaRecorder to fire ondataavailable every 1000ms
      this.mediaRecorder.start(1000);
      this.isActive = true;

      // Start periodic chunk processing
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
    // Process accumulated audio every 3 seconds
    this.chunkTimer = window.setInterval(() => {
      this.processAccumulatedAudio();
    }, this.chunkInterval);
  }

  private async processAccumulatedAudio() {
    if (this.audioChunks.length === 0) {
      console.log('⏭️ No audio chunks to process');
      return;
    }

    // Get all accumulated chunks
    const chunksToProcess = [...this.audioChunks];
    this.audioChunks = []; // Clear for next batch

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        console.log(`🔄 Processing ${chunksToProcess.length} audio chunks`);
        
        // Combine chunks into single blob
        const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm' });
        console.log(`📊 Combined audio size: ${audioBlob.size} bytes`);

        // Skip if too small (less than 10KB - likely silence)
        if (audioBlob.size < 10000) {
          console.log('⏭️ Skipping small audio chunk (likely silence)');
          return;
        }

        // Convert to base64
        const base64Audio = await this.blobToBase64(audioBlob);

        // Send to Whisper API via edge function
        const { data, error } = await supabase.functions.invoke('whisper-transcribe', {
          body: {
            audio: base64Audio,
            language: this.config.language
          }
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
