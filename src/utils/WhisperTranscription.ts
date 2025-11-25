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
  private processingQueue: Promise<void> = Promise.resolve();
  private fullTranscript: string = '';

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
      // Try different mime types for better OpenAI compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }
      
      console.log('🎬 Using MIME type:', mimeType);
      const options = { 
        mimeType,
        audioBitsPerSecond: 128000
      };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
          this.processAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        if (this.config.onError) {
          this.config.onError('Recording error occurred');
        }
      };

      // Start recording with 10-second chunks for complete, properly-formatted audio
      this.mediaRecorder.start(10000);
      this.isActive = true;

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

  private async processAudioChunk(audioBlob: Blob) {
    // Skip if too small - need at least 1 second of audio at 128kbps
    if (audioBlob.size < 15000) {
      console.log('⏭️ Skipping small audio chunk:', audioBlob.size, 'bytes');
      return;
    }

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        console.log(`📊 Processing WebM blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

        // Send WebM audio blob to edge function
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', this.config.language || 'en');

        console.log('📤 Sending to edge function...');
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

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    this.isActive = false;

    if (this.config.onEnd) {
      this.config.onEnd();
    }

    return this.fullTranscript;
  }

  public pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
    console.log('⏸️ Whisper transcription paused');
  }

  public resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
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
    this.fullTranscript = '';
  }
}
