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
  onSpeakerChange?: (speaker: 'Doctor' | 'Patient') => void;
}

interface ConversationTurn {
  speaker: 'Doctor' | 'Patient';
  text: string;
  timestamp: number;
  confidence: number;
}

export class RealTimeTranscription {
  private recognition: any = null;
  private isSupported: boolean = false;
  private isListening: boolean = false;
  private config: TranscriptionConfig;
  private fullTranscript: string = '';
  private interimTranscript: string = '';
  private conversationTurns: ConversationTurn[] = [];
  private currentSpeaker: 'Doctor' | 'Patient' = 'Doctor';
  private lastSpeechTimestamp: number = 0;
  private pauseThreshold: number = 2000; // 2 seconds pause indicates speaker change
  private consecutiveSentences: number = 0;
  private sentenceCountBeforeSwitch: number = 2; // Switch speaker after 2-3 sentences

  constructor(config: TranscriptionConfig = {}) {
    this.config = {
      continuous: true,
      interimResults: true,
      lang: config.lang || 'kn-IN', // Default to Kannada (Karnataka, India)
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
    this.recognition.maxAlternatives = 10; // Maximum alternatives for best accuracy
    
    // Detect if running on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log(`📱 Device type: ${isMobile ? 'Mobile' : 'Desktop'}`);
    
    // Mobile-optimized settings for better performance
    if (isMobile) {
      // On mobile, reduce alternatives to improve performance
      this.recognition.maxAlternatives = 5;
      console.log('📱 Mobile optimizations applied');
    }

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
      let finalConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        // Advanced: Select best alternative based on confidence and medical context
        let bestTranscript = result[0].transcript;
        let bestConfidence = result[0].confidence || 0;
        
        // Comprehensive medical terminology database
        const medicalTerms = [
          // Common conditions
          'diabetes', 'hypertension', 'asthma', 'copd', 'arthritis', 'migraine',
          'depression', 'anxiety', 'obesity', 'cholesterol', 'thyroid', 'anemia',
          // Medications
          'medication', 'prescription', 'tablet', 'capsule', 'injection', 'syrup',
          'antibiotic', 'painkiller', 'insulin', 'metformin', 'aspirin', 'ibuprofen',
          // Symptoms
          'symptoms', 'fever', 'pain', 'headache', 'nausea', 'vomiting', 'diarrhea',
          'cough', 'cold', 'fatigue', 'weakness', 'dizziness', 'breathlessness',
          // Medical procedures
          'diagnosis', 'treatment', 'surgery', 'therapy', 'consultation', 'examination',
          'checkup', 'followup', 'screening', 'vaccination', 'immunization',
          // Vital signs
          'blood pressure', 'temperature', 'heart rate', 'pulse', 'oxygen',
          'saturation', 'spo2', 'glucose', 'weight', 'bmi',
          // Medical tests
          'test', 'report', 'scan', 'x-ray', 'mri', 'ct', 'ultrasound', 'ecg',
          'ekg', 'lab', 'blood test', 'urine test', 'biopsy', 'endoscopy',
          // Medical professionals
          'doctor', 'patient', 'nurse', 'specialist', 'surgeon', 'physician',
          // Body parts
          'chest', 'abdomen', 'back', 'knee', 'shoulder', 'neck', 'head',
          // Other
          'allergy', 'chronic', 'acute', 'severe', 'mild', 'moderate'
        ];
        
        // Advanced alternative selection with weighted scoring
        for (let j = 1; j < result.length && j < 10; j++) {
          const altConfidence = result[j].confidence || 0;
          const altTranscript = result[j].transcript;
          const altLower = altTranscript.toLowerCase();
          
          // Count medical terms in alternative
          let medicalTermCount = 0;
          let medicalTermScore = 0;
          medicalTerms.forEach(term => {
            if (altLower.includes(term)) {
              medicalTermCount++;
              // Weight longer medical terms higher
              medicalTermScore += term.length / 10;
            }
          });
          
          // Calculate weighted score: confidence + medical term bonus
          const currentScore = bestConfidence + (bestTranscript.toLowerCase().split(' ').filter(word => 
            medicalTerms.some(term => word.includes(term))
          ).length * 0.05);
          
          const altScore = altConfidence + (medicalTermScore * 0.1);
          
          // Prefer alternatives with better overall score
          if (altScore > currentScore || (medicalTermCount > 2 && altConfidence > bestConfidence * 0.8)) {
            bestTranscript = altTranscript;
            bestConfidence = altConfidence;
          }
        }
        
        console.log(`📝 Result ${i}: ${result.isFinal ? 'Final' : 'Interim'} (confidence: ${bestConfidence?.toFixed(2) || 'N/A'}) - "${bestTranscript.substring(0, 50)}..."`);
        
        if (result.isFinal) {
          finalTranscript += bestTranscript + ' ';
          finalConfidence = bestConfidence;
        } else {
          interimTranscript += bestTranscript;
        }
      }

      if (finalTranscript) {
        const trimmedFinal = finalTranscript.trim();
        
        // Advanced speaker change detection
        const currentTime = Date.now();
        const timeSinceLastSpeech = currentTime - this.lastSpeechTimestamp;
        
        // Detect speaker change based on:
        // 1. Long pause (> 2 seconds)
        // 2. Sentence patterns (questions vs statements)
        // 3. Consecutive sentences from same speaker
        let shouldSwitchSpeaker = false;
        
        if (timeSinceLastSpeech > this.pauseThreshold) {
          shouldSwitchSpeaker = true;
          console.log('🔄 Speaker change detected (long pause)');
        } else if (this.detectQuestionPattern(trimmedFinal) && this.currentSpeaker === 'Patient') {
          shouldSwitchSpeaker = true;
          console.log('🔄 Speaker change detected (question from patient -> doctor)');
        } else if (this.consecutiveSentences >= this.sentenceCountBeforeSwitch) {
          shouldSwitchSpeaker = true;
          this.consecutiveSentences = 0;
          console.log('🔄 Speaker change detected (consecutive sentences limit)');
        }
        
        if (shouldSwitchSpeaker) {
          this.currentSpeaker = this.currentSpeaker === 'Doctor' ? 'Patient' : 'Doctor';
          this.consecutiveSentences = 0;
          if (this.config.onSpeakerChange) {
            this.config.onSpeakerChange(this.currentSpeaker);
          }
        }
        
        this.consecutiveSentences++;
        this.lastSpeechTimestamp = currentTime;
        
        // Store conversation turn
        this.conversationTurns.push({
          speaker: this.currentSpeaker,
          text: trimmedFinal,
          timestamp: currentTime,
          confidence: finalConfidence
        });
        
        // Format with speaker label
        const formattedTranscript = `**${this.currentSpeaker}:** ${trimmedFinal}`;
        this.fullTranscript += (this.fullTranscript ? '\n\n' : '') + formattedTranscript;
        
        console.log(`✅ Final transcript chunk (${this.currentSpeaker}):`, trimmedFinal);
        console.log(`📊 Total turns: ${this.conversationTurns.length}, Total length: ${this.fullTranscript.length} characters`);
        
        if (this.config.onResult) {
          this.config.onResult(trimmedFinal, true);
        }
      }

      if (interimTranscript && this.config.onResult) {
        console.log('⏳ Interim update:', interimTranscript.substring(0, 50), '...');
        this.config.onResult(interimTranscript, false);
      }

      this.interimTranscript = interimTranscript;
    };

    this.recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      
      let errorMessage = 'Transcription error occurred';
      let shouldRestart = false;
      
      switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected. Please check your audio and try again.';
        shouldRestart = true;
        break;
      case 'audio-capture':
        errorMessage = 'Microphone not accessible. Please check permissions and ensure your device microphone is working.';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone permission denied. Please grant microphone access in your browser settings.';
        break;
      case 'network':
        errorMessage = 'Network error. Please check your internet connection.';
        shouldRestart = true;
        break;
      case 'aborted':
        // Don't show error for intentional aborts
        console.log('🔇 Transcription intentionally aborted');
        return; // Exit early, don't restart
      case 'service-not-allowed':
        errorMessage = 'Speech recognition service not available. Please try again later.';
        break;
      default:
        errorMessage = `Transcription error: ${event.error}`;
    }

      if (this.config.onError) {
        this.config.onError(errorMessage);
      }

      // Advanced auto-restart with exponential backoff
      if (this.config.continuous && shouldRestart) {
        const restartDelay = event.error === 'network' ? 500 : 200;
        console.log(`⏳ Auto-restarting recognition in ${restartDelay}ms...`);
        setTimeout(() => {
          if (this.isListening) {
            try {
              console.log('🔄 Restarting recognition...');
              this.isListening = false;
              this.recognition.start();
            } catch (e) {
              console.error('Failed to restart:', e);
              // Exponential backoff retry
              setTimeout(() => {
                if (!this.isListening) {
                  try {
                    this.recognition.start();
                  } catch (retryError) {
                    console.error('Restart retry failed:', retryError);
                    // Final retry after longer delay
                    setTimeout(() => {
                      if (!this.isListening) {
                        try {
                          this.recognition.start();
                        } catch (finalError) {
                          console.error('Final restart failed:', finalError);
                        }
                      }
                    }, 3000);
                  }
                }
              }, 1500);
            }
          }
        }, restartDelay);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended, was listening:', this.isListening);
      const wasListening = this.isListening;
      this.isListening = false;
      
      if (this.config.onEnd) {
        this.config.onEnd();
      }

      // Advanced auto-restart with adaptive delay
      if (this.config.continuous && wasListening) {
        console.log('🔄 Continuous mode - restarting in 150ms...');
        setTimeout(() => {
          try {
            this.recognition.start();
            this.isListening = true;
            console.log('✅ Recognition restarted successfully');
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            // Progressive retry with increasing delays
            setTimeout(() => {
              try {
                this.recognition.start();
                this.isListening = true;
                console.log('✅ Recognition restarted on second attempt');
              } catch (retryError) {
                console.error('Second restart attempt failed:', retryError);
                // Final attempt with longer delay
                setTimeout(() => {
                  try {
                    this.recognition.start();
                    this.isListening = true;
                    console.log('✅ Recognition restarted on final attempt');
                  } catch (finalError) {
                    console.error('All restart attempts failed:', finalError);
                  }
                }, 2000);
              }
            }, 800);
          }
        }, 150);
      }
    };
  }

  private detectQuestionPattern(text: string): boolean {
    const questionIndicators = [
      'what', 'how', 'when', 'where', 'why', 'which',
      'can you', 'could you', 'would you', 'do you',
      'is it', 'are you', 'have you', 'did you'
    ];
    const lowerText = text.toLowerCase();
    return questionIndicators.some(q => lowerText.includes(q)) || text.trim().endsWith('?');
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
      this.conversationTurns = [];
      this.currentSpeaker = 'Doctor'; // Always start with doctor
      this.lastSpeechTimestamp = Date.now();
      this.consecutiveSentences = 0;
      console.log('🎙️ Starting transcription - Initial speaker: Doctor');
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
    if (this.isListening && this.recognition) {
      try {
        console.log('⏸️ Pausing speech recognition');
        // Use stop instead of abort to allow clean restart
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        console.error('Error pausing recognition:', error);
      }
    }
  }

  public resume() {
    if (!this.isListening && this.isSupported && this.recognition) {
      try {
        console.log('▶️ Resuming speech recognition');
        this.recognition.start();
        this.isListening = true;
      } catch (error) {
        console.error('Error resuming recognition:', error);
        if (this.config.onError) {
          this.config.onError('Failed to resume transcription');
        }
      }
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

  public getConversationTurns(): ConversationTurn[] {
    return this.conversationTurns;
  }

  public getTurnCount(): number {
    return this.conversationTurns.length;
  }

  public getCurrentSpeaker(): 'Doctor' | 'Patient' {
    return this.currentSpeaker;
  }

  public destroy() {
    if (this.recognition) {
      this.stop();
      this.recognition = null;
    }
    this.conversationTurns = [];
  }
}
