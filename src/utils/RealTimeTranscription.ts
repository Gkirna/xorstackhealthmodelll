/**
 * Real-Time Speech-to-Text Transcription
 * Uses Web Speech API for browser-based transcription
 */

export interface TranscriptionConfig {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class RealTimeTranscription {
  private recognition: any = null;
  private isSupported: boolean = false;
  private isListening: boolean = false;
  private config: TranscriptionConfig;
  private fullTranscript: string = '';
  private interimTranscript: string = '';

  constructor(config: TranscriptionConfig = {}) {
    this.config = {
      continuous: true,
      interimResults: true,
      lang: 'en-US',
      ...config
    };

    // Check for browser support
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    } else {
      console.warn('Web Speech API not supported in this browser');
      this.isSupported = false;
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.lang;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      if (this.config.onStart) {
        this.config.onStart();
      }
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.fullTranscript += finalTranscript;
        if (this.config.onResult) {
          this.config.onResult(finalTranscript.trim(), true);
        }
      }

      if (interimTranscript && this.config.onResult) {
        this.config.onResult(interimTranscript, false);
      }

      this.interimTranscript = interimTranscript;
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Transcription error occurred';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not accessible. Please check permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please grant access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          errorMessage = 'Transcription aborted.';
          break;
        default:
          errorMessage = `Transcription error: ${event.error}`;
      }

      if (this.config.onError) {
        this.config.onError(errorMessage);
      }

      // Auto-restart on certain errors
      if (this.config.continuous && ['no-speech', 'audio-capture'].includes(event.error)) {
        setTimeout(() => {
          if (this.isListening) {
            console.log('Auto-restarting recognition...');
            this.recognition.start();
          }
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      
      if (this.config.onEnd) {
        this.config.onEnd();
      }

      // Auto-restart if continuous mode
      if (this.config.continuous && this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };
  }

  public start(): boolean {
    if (!this.isSupported) {
      if (this.config.onError) {
        this.config.onError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      }
      return false;
    }

    if (this.isListening) {
      console.warn('Already listening');
      return false;
    }

    try {
      this.fullTranscript = '';
      this.interimTranscript = '';
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start recognition:', error);
      if (this.config.onError) {
        this.config.onError('Failed to start transcription');
      }
      return false;
    }
  }

  public stop(): string {
    if (!this.isListening) {
      return this.fullTranscript;
    }

    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }

    return this.fullTranscript;
  }

  public pause() {
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  public resume() {
    if (!this.isListening && this.isSupported) {
      this.recognition.start();
    }
  }

  public getFullTranscript(): string {
    return this.fullTranscript;
  }

  public getInterimTranscript(): string {
    return this.interimTranscript;
  }

  public isActive(): boolean {
    return this.isListening;
  }

  public isBrowserSupported(): boolean {
    return this.isSupported;
  }

  public destroy() {
    if (this.recognition) {
      this.stop();
      this.recognition = null;
    }
  }
}
