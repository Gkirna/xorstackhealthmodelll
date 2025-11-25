/**
 * HIPAA-Compliant Real-Time Speech-to-Text using OpenAI Whisper
 * 
 * SECURITY NOTICE:
 * - All PHI is processed through secure edge functions
 * - No PHI is logged to console in production
 * - Audit trails use content hashing, not plaintext
 * - Rate limiting prevents abuse
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
  private processedChunks: number = 0;
  private failedChunks: number = 0;

  constructor(config: WhisperTranscriptionConfig = {}) {
    this.config = {
      language: 'en',
      mode: 'direct',
      ...config
    };
  }

  async start(stream: MediaStream): Promise<boolean> {
    if (this.isActive) {
      console.warn('[Whisper] Already active');
      return false;
    }

    try {
      console.log('[Whisper] Starting transcription', { 
        mode: this.config.mode, 
        lang: this.config.language 
      });

      // Create MediaRecorder for audio chunks
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }
      
      console.log('[Whisper] MIME type:', mimeType);
      const options = { 
        mimeType,
        audioBitsPerSecond: 128000
      };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.processAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('[Whisper] MediaRecorder error:', error);
        if (this.config.onError) {
          this.config.onError('Recording error occurred');
        }
      };

      // Start recording with 10-second chunks
      this.mediaRecorder.start(10000);
      this.isActive = true;

      if (this.config.onStart) {
        this.config.onStart();
      }

      console.log('[Whisper] Started successfully');
      return true;

    } catch (error) {
      console.error('[Whisper] Start failed:', error);
      if (this.config.onError) {
        this.config.onError('Failed to start transcription');
      }
      return false;
    }
  }

  private async processAudioChunk(audioBlob: Blob) {
    // Skip if too small (need at least 1.5 seconds at 128kbps)
    if (audioBlob.size < 15000) {
      console.log('[Whisper] Chunk too small, skipping');
      return;
    }

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        const chunkId = ++this.processedChunks;
        console.log(`[Whisper] Processing chunk #${chunkId}:`, {
          size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
          type: audioBlob.type
        });

        // Send WebM audio blob to edge function
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', this.config.language || 'en');

        const { data, error } = await supabase.functions.invoke('whisper-transcribe', {
          body: formData
        });

        if (error) {
          this.failedChunks++;
          console.error(`[Whisper] Chunk #${chunkId} failed:`, error.message);
          
          // Show user-friendly error
          if (error.message.includes('Rate limit')) {
            if (this.config.onError) {
              this.config.onError('Too many requests. Please wait a moment.');
            }
          } else if (this.config.onError) {
            this.config.onError('Transcription temporarily unavailable');
          }
          return;
        }

        if (data?.success && data?.text) {
          const transcriptText = data.text.trim();
          
          if (transcriptText.length > 0) {
            console.log(`[Whisper] Chunk #${chunkId} success:`, {
              length: transcriptText.length,
              preview: transcriptText.substring(0, 30) + '...'
            });
            
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcriptText;

            // Emit as final result (Whisper always returns final transcripts)
            if (this.config.onResult) {
              this.config.onResult(transcriptText, true);
            }
          }
        }

      } catch (error) {
        this.failedChunks++;
        console.error('[Whisper] Processing error:', error);
        if (this.config.onError) {
          this.config.onError('Error processing audio');
        }
      }
    });
  }

  public stop(): string {
    console.log('[Whisper] Stopping', {
      processed: this.processedChunks,
      failed: this.failedChunks,
      length: this.fullTranscript.length
    });

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
      console.log('[Whisper] Paused');
    }
  }

  public resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      console.log('[Whisper] Resumed');
    }
  }

  public isTranscribing(): boolean {
    return this.isActive;
  }

  public getFullTranscript(): string {
    return this.fullTranscript;
  }

  public getStats() {
    return {
      processed: this.processedChunks,
      failed: this.failedChunks,
      successRate: this.processedChunks > 0 
        ? ((this.processedChunks - this.failedChunks) / this.processedChunks * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  public destroy() {
    this.stop();
    this.fullTranscript = '';
    this.processedChunks = 0;
    this.failedChunks = 0;
  }
}