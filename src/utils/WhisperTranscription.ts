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
  private chunkInterval: number = 5000; // Send chunks every 5 seconds (minimum for valid WebM)
  private currentRecordingStart: number = 0;

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

      // Create MediaRecorder - record continuously for valid WebM files
      const options = { mimeType: 'audio/webm;codecs=opus' };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📦 Audio chunk collected: ${event.data.size} bytes`);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        console.log('⏹️ MediaRecorder stopped, processing final chunk');
        this.processAccumulatedAudio();
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        if (this.config.onError) {
          this.config.onError('Recording error occurred');
        }
      };

      // Start recording - use stop/restart pattern for valid WebM files
      this.isActive = true;
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
    // Start/stop MediaRecorder every 5 seconds to create valid WebM files
    this.startRecordingChunk();
    
    this.chunkTimer = window.setInterval(() => {
      this.stopAndRestartRecording();
    }, this.chunkInterval);
  }
  
  private startRecordingChunk() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.audioChunks = []; // Clear chunks for new recording
      this.mediaRecorder.start();
      this.currentRecordingStart = Date.now();
      console.log('🎙️ Started recording chunk');
    }
  }
  
  private stopAndRestartRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('⏹️ Stopping current chunk to process');
      this.mediaRecorder.stop(); // This triggers ondataavailable and onstop
      
      // Restart recording after a brief delay
      setTimeout(() => {
        this.startRecordingChunk();
      }, 100);
    }
  }

  private async processAccumulatedAudio() {
    if (this.audioChunks.length === 0) {
      console.log('⏭️ No audio chunks to process');
      return;
    }

    // Get all accumulated chunks (should be a complete WebM file from stop())
    const chunksToProcess = [...this.audioChunks];
    const recordingDuration = Date.now() - this.currentRecordingStart;
    console.log(`⏱️ Recording duration: ${recordingDuration}ms`);
    
    // Don't clear immediately - will be cleared when starting next chunk
    // this.audioChunks = [];

    // Add to processing queue to prevent overlapping requests
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        console.log(`🔄 Processing ${chunksToProcess.length} audio chunks`);
        
        // Combine chunks into single blob (should be complete WebM file)
        const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' });
        console.log(`📊 Audio blob size: ${audioBlob.size} bytes (${chunksToProcess.length} chunks)`);

        // Skip if too small (less than 20KB - likely silence or incomplete)
        if (audioBlob.size < 20000) {
          console.log('⏭️ Skipping small audio chunk (likely silence)');
          return;
        }
        
        // Analyze audio to detect if it contains speech
        const hasVoiceActivity = await this.detectVoiceActivity(audioBlob);
        if (!hasVoiceActivity) {
          console.log('⏭️ Skipping silent audio chunk (no voice detected)');
          return;
        }
        
        // Log first few bytes to verify WebM header (should start with 0x1A 0x45 0xDF 0xA3)
        const headerCheck = new Uint8Array(await audioBlob.slice(0, 4).arrayBuffer());
        console.log('📋 File header:', Array.from(headerCheck).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

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
          
          // Better error message for users
          let errorMessage = 'Transcription failed';
          if (error.message?.includes('Invalid file format')) {
            errorMessage = 'Audio format error - retrying with next chunk';
            console.log('ℹ️ Will retry with next audio chunk');
          } else if (error.message?.includes('Edge Function')) {
            errorMessage = 'Connection error - check network';
          }
          
          if (this.config.onError) {
            this.config.onError(errorMessage);
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

  private async detectVoiceActivity(audioBlob: Blob): Promise<boolean> {
    try {
      // Create audio context for analysis
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio samples from first channel
      const channelData = audioBuffer.getChannelData(0);
      
      // Calculate RMS (Root Mean Square) energy
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sumSquares / channelData.length);
      
      // Calculate peak amplitude
      let peak = 0;
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > peak) peak = abs;
      }
      
      // Close audio context to free resources
      await audioContext.close();
      
      // Voice activity threshold (empirically determined)
      // RMS > 0.01 AND peak > 0.05 typically indicates voice
      const hasVoice = rms > 0.01 && peak > 0.05;
      
      console.log(`🔊 Audio analysis: RMS=${rms.toFixed(4)}, Peak=${peak.toFixed(4)}, Voice=${hasVoice}`);
      
      return hasVoice;
    } catch (error) {
      console.error('❌ Voice activity detection failed:', error);
      // If analysis fails, assume there might be voice to avoid false negatives
      return true;
    }
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

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('⏹️ Stopping final recording chunk');
      this.mediaRecorder.stop(); // This will trigger onstop which processes the audio
    }
    
    this.mediaRecorder = null;
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
