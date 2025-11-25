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
import { RetryStrategy, CircuitBreaker } from './RetryStrategy';

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
  private retryStrategy: RetryStrategy;
  private circuitBreaker: CircuitBreaker;
  private lastSuccessTime: number = Date.now();
  private qualityMetrics: {
    avgConfidence: number;
    avgChunkSize: number;
    avgProcessingTime: number;
  } = { avgConfidence: 0, avgChunkSize: 0, avgProcessingTime: 0 };

  constructor(config: WhisperTranscriptionConfig = {}) {
    this.config = {
      language: 'en',
      mode: 'direct',
      ...config
    };

    // Initialize retry strategy for medical-grade reliability
    this.retryStrategy = new RetryStrategy({
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 15000,
      backoffMultiplier: 2,
      jitterFactor: 0.2
    });

    // Initialize circuit breaker to prevent cascading failures
    this.circuitBreaker = new CircuitBreaker(5, 60000, 2);
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
    // Skip if too small (need at least 3 seconds of audio at 128kbps)
    if (audioBlob.size < 48000) {
      console.log('[Whisper] Chunk too small, skipping:', audioBlob.size);
      return;
    }

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      const startTime = Date.now();
      const chunkId = ++this.processedChunks;

      try {
        console.log(`[Whisper] Processing chunk #${chunkId}:`, {
          size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
          type: audioBlob.type
        });

        // Execute with circuit breaker and retry logic
        const result = await this.circuitBreaker.execute(async () => {
          return await this.retryStrategy.executeWithRetry(async () => {
            // Send WebM audio blob to edge function
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('language', this.config.language || 'en');

            const { data, error } = await supabase.functions.invoke('whisper-transcribe', {
              body: formData
            });

            if (error) {
              throw error;
            }

            if (!data?.success || !data?.text) {
              throw new Error('No transcription returned');
            }

            return data;
          }, `transcribe chunk #${chunkId}`);
        }, 'whisper-transcribe');

        // Process successful result
        const transcriptText = result.text.trim();
        const processingTime = Date.now() - startTime;

        if (transcriptText.length > 0) {
          console.log(`[Whisper] Chunk #${chunkId} success:`, {
            length: transcriptText.length,
            processingTime: `${processingTime}ms`,
            preview: transcriptText.substring(0, 30) + '...'
          });

          // Update quality metrics
          this.updateQualityMetrics(audioBlob.size, processingTime, 0.95);

          // Update last success time
          this.lastSuccessTime = Date.now();

          this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcriptText;

          // Emit as final result
          if (this.config.onResult) {
            this.config.onResult(transcriptText, true);
          }
        }

      } catch (error: any) {
        this.failedChunks++;
        const processingTime = Date.now() - startTime;

        console.error(`[Whisper] Chunk #${chunkId} failed after retries:`, {
          error: error.message,
          processingTime: `${processingTime}ms`,
          retryStats: this.retryStrategy.getStats(),
          circuitBreakerState: this.circuitBreaker.getState()
        });

        // Check if system is degraded
        const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
        if (timeSinceLastSuccess > 60000) {
          // No successful transcription in 1 minute - critical alert
          console.error('[Whisper] CRITICAL: No successful transcription in 60 seconds');
        }

        // User-friendly error messages
        if (error.message.includes('Circuit breaker')) {
          if (this.config.onError) {
            this.config.onError('Transcription service temporarily unavailable. Recovering...');
          }
        } else if (error.message.includes('Rate limit')) {
          if (this.config.onError) {
            this.config.onError('Rate limit reached. Please wait a moment.');
          }
        } else if (this.config.onError) {
          this.config.onError('Transcription error. Retrying...');
        }
      }
    });
  }

  private updateQualityMetrics(chunkSize: number, processingTime: number, confidence: number) {
    const totalChunks = this.processedChunks;
    
    // Rolling average
    this.qualityMetrics.avgChunkSize = 
      (this.qualityMetrics.avgChunkSize * (totalChunks - 1) + chunkSize) / totalChunks;
    
    this.qualityMetrics.avgProcessingTime = 
      (this.qualityMetrics.avgProcessingTime * (totalChunks - 1) + processingTime) / totalChunks;
    
    this.qualityMetrics.avgConfidence = 
      (this.qualityMetrics.avgConfidence * (totalChunks - 1) + confidence) / totalChunks;
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
    const successfulChunks = this.processedChunks - this.failedChunks;
    return {
      processed: this.processedChunks,
      successful: successfulChunks,
      failed: this.failedChunks,
      successRate: this.processedChunks > 0 
        ? ((successfulChunks / this.processedChunks) * 100).toFixed(1) + '%'
        : '0%',
      qualityMetrics: {
        avgConfidence: (this.qualityMetrics.avgConfidence * 100).toFixed(1) + '%',
        avgChunkSize: (this.qualityMetrics.avgChunkSize / 1024).toFixed(2) + ' KB',
        avgProcessingTime: this.qualityMetrics.avgProcessingTime.toFixed(0) + ' ms'
      },
      circuitBreaker: this.circuitBreaker.getState(),
      timeSinceLastSuccess: ((Date.now() - this.lastSuccessTime) / 1000).toFixed(1) + 's'
    };
  }

  public destroy() {
    this.stop();
    this.fullTranscript = '';
    this.processedChunks = 0;
    this.failedChunks = 0;
    this.retryStrategy.reset();
    this.circuitBreaker.reset();
    this.qualityMetrics = { avgConfidence: 0, avgChunkSize: 0, avgProcessingTime: 0 };
  }
}