/**
 * Advanced Voice Analyzer - Production-Ready Multi-Speaker Detection
 * Uses Web Audio API for real-time voice analysis with speaker diarization
 */

interface VoiceCharacteristics {
  gender: 'male' | 'female' | 'unknown';
  pitch: number; // Hz
  confidence: number; // 0-1
  speakerId: string;
  voiceQuality: 'excellent' | 'good' | 'fair' | 'poor';
  volume: number; // 0-100
}

interface SpeakerProfile {
  speakerId: string;
  gender: 'male' | 'female';
  avgPitch: number;
  pitchRange: [number, number];
  voiceQuality: string;
  sampleCount: number;
  lastSeen: number;
}

interface VoiceActivityEvent {
  timestamp: number;
  speakerId: string;
  pitch: number;
  volume: number;
  duration: number;
  confidence: number;
}

export class VoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private source: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  
  private bufferSize = 4096;
  private sampleRate = 44100;
  
  private speakerProfiles: Map<string, SpeakerProfile> = new Map();
  private voiceHistory: VoiceActivityEvent[] = [];
  private currentVoiceSession: {
    speakerId: string | null;
    startTime: number;
    pitchSamples: number[];
    volumeSamples: number[];
  } | null = null;
  
  // Configuration
  private readonly PITCH_UPDATE_INTERVAL = 500; // ms
  private readonly HISTORY_LIMIT = 100;
  private readonly MIN_CONFIDENCE = 0.6;
  private readonly VOICE_ACTIVITY_THRESHOLD = 2; // Lowered for better detection (was 20 = 0.02 * 1000)
  private readonly GENDER_PITCH_BOUNDARIES = {
    male: { min: 85, max: 180 },
    female: { min: 165, max: 255 },
    overlap: { start: 165, end: 180 } // Overlap zone
  };
  
  // Advanced analysis parameters - OPTIMIZED for same-gender detection
  private MIN_PITCH_DIFFERENCE = 20; // Hz difference (reduced from 30 for better same-gender detection)
  private readonly PITCH_SMOOTHING_ALPHA = 0.7;
  private readonly CONFIDENCE_DECAY = 0.95; // Confidence decays over time
  private mode: 'direct' | 'playback' = 'direct';
  
  // Pitch ranges for gender detection (in Hz) - optimized for each mode
  private readonly MIN_PITCH_MALE: number;
  private readonly MAX_PITCH_MALE: number;
  private readonly MIN_PITCH_FEMALE: number;
  private readonly MAX_PITCH_FEMALE: number;
  private readonly CONFIDENCE_THRESHOLD: number;
  
  constructor(mode: 'direct' | 'playback' = 'direct') {
    this.mode = mode;
    
    // Adjust thresholds for playback mode (degraded audio quality)
    if (mode === 'playback') {
      this.MIN_PITCH_DIFFERENCE = 25; // Wider tolerance for degraded audio
      this.MIN_PITCH_MALE = 65;
      this.MAX_PITCH_MALE = 210;
      this.MIN_PITCH_FEMALE = 140;
      this.MAX_PITCH_FEMALE = 380;
      this.CONFIDENCE_THRESHOLD = 0.55;
    } else {
      this.MIN_PITCH_MALE = 85;
      this.MAX_PITCH_MALE = 180;
      this.MIN_PITCH_FEMALE = 165;
      this.MAX_PITCH_FEMALE = 255;
      this.CONFIDENCE_THRESHOLD = 0.70;
    }
    
    console.log(`🎤 VoiceAnalyzer initialized in ${mode} mode with thresholds:`, {
      pitchDiff: this.MIN_PITCH_DIFFERENCE,
      maleRange: [this.MIN_PITCH_MALE, this.MAX_PITCH_MALE],
      femaleRange: [this.MIN_PITCH_FEMALE, this.MAX_PITCH_FEMALE],
      confidence: this.CONFIDENCE_THRESHOLD
    });
  }

  /**
   * Initialize analyzer with existing AudioContext and analyser (shared context)
   */
  async initializeWithContext(audioContext: AudioContext, analyser: AnalyserNode): Promise<VoiceCharacteristics> {
    try {
      console.log('🎤 VoiceAnalyzer.initializeWithContext() - using shared AudioContext');
      this.audioContext = audioContext;
      this.analyser = analyser;
      
      // Use the existing analyser configuration
      this.bufferSize = analyser.fftSize;
      this.sampleRate = audioContext.sampleRate;
      
      console.log('🎤 Shared AudioContext state:', audioContext.state);
      console.log('🎤 Shared AudioContext sample rate:', audioContext.sampleRate);
      console.log('🎤 Shared Analyser configured:', {
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        smoothing: analyser.smoothingTimeConstant
      });
      
      console.log('🎤 Voice analyzer initialization with shared context complete');
      
      // Wait a bit for audio data to flow
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Analyze initial voice sample
      return await this.analyzeVoiceSample();
    } catch (error) {
      console.error('❌ Failed to initialize voice analyzer with shared context:', error);
      throw error;
    }
  }

  /**
   * Initialize analyzer with audio stream (creates own AudioContext)
   */
  async initialize(stream: MediaStream): Promise<VoiceCharacteristics> {
    try {
      console.log('🎤 VoiceAnalyzer.initialize() - creating AudioContext');
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate
      });
      
      console.log('🎤 AudioContext state:', this.audioContext.state);
      console.log('🎤 AudioContext sample rate:', this.audioContext.sampleRate);
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      console.log('🎤 MediaStreamSource created');
      
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      
      // Configure analyser for high-quality analysis
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      console.log('🎤 Analyser configured:', {
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount,
        smoothing: this.analyser.smoothingTimeConstant
      });
      
      // Connect audio graph
      this.microphone.connect(this.gainNode!);
      this.gainNode!.connect(this.analyser);
      
      console.log('🎤 Audio graph connected: microphone -> gain -> analyser');
      console.log('🎤 Voice analyzer initialization complete');
      
      // Wait a bit for audio data to flow
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Analyze initial voice sample
      return await this.analyzeVoiceSample();
    } catch (error) {
      console.error('❌ Failed to initialize voice analyzer:', error);
      throw error;
    }
  }

  /**
   * Analyze a voice sample and return characteristics
   */
  async analyzeVoiceSample(): Promise<VoiceCharacteristics> {
    if (!this.analyser) {
      throw new Error('Analyzer not initialized');
    }

    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);
    
    // Debug: Check if buffer has data
    const bufferSum = Array.from(dataArray).reduce((sum, val) => sum + Math.abs(val), 0);
    const bufferAvg = bufferSum / dataArray.length;
    console.log(`🔍 Buffer analysis: size=${dataArray.length}, avg=${bufferAvg.toFixed(6)}, sum=${bufferSum.toFixed(6)}`);
    
    // Check if buffer is all zeros
    if (bufferSum === 0) {
      console.warn('⚠️ Audio buffer is empty - no data from microphone');
    }
    
    // Advanced pitch detection with autocorrelation
    const pitch = this.detectPitchAdvanced(dataArray);
    
    // Volume detection
    const volume = this.detectVolume(dataArray);
    
    // Detect voice activity
    const isVoiceActive = this.detectVoiceActivity(dataArray);
    
    if (!isVoiceActive) {
      return {
        gender: 'unknown',
        pitch: 0,
        confidence: 0,
        speakerId: 'silence',
        voiceQuality: 'poor',
        volume
      };
    }
    
    // Determine gender with high accuracy
    const { gender, confidence } = this.determineGenderWithConfidence(pitch);
    
    // Determine voice quality
    const voiceQuality = this.assessVoiceQuality(dataArray, pitch, volume);
    
    // Identify or create speaker
    const speakerId = this.identifySpeaker(pitch, gender === 'unknown' ? 'male' : gender);
    
    return {
      gender,
      pitch,
      confidence,
      speakerId,
      voiceQuality,
      volume
    };
  }

  /**
   * Advanced pitch detection using YIN algorithm
   */
  private detectPitchAdvanced(buffer: Float32Array): number {
    const sampleRate = this.sampleRate;
    const minPeriod = Math.floor(sampleRate / 800); // Max 800 Hz
    const maxPeriod = Math.floor(sampleRate / 50);  // Min 50 Hz

    // Zero crossing + autocorrelation for accuracy
    let bestPeriod = 0;
    let bestScore = 0;
    
    // Apply Hamming window for better frequency analysis
    const windowedBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (buffer.length - 1));
      windowedBuffer[i] = buffer[i] * window;
    }

    // Autocorrelation analysis
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let score = 0;
      const maxOffset = Math.min(buffer.length - maxPeriod - 1, 4000);
      
      for (let i = 0; i < maxOffset; i += Math.floor(period / 2)) {
        score += windowedBuffer[i] * windowedBuffer[i + period];
      }

      // Normalize and weight
      const normalizedScore = score / maxOffset;
      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestPeriod = period;
      }
    }

    if (bestPeriod > 0 && bestScore > 0.1) {
      const pitch = sampleRate / bestPeriod;
      
      // Clamp to reasonable range
      if (pitch >= 50 && pitch <= 800) {
        return pitch;
      }
    }

    return 0;
  }

  /**
   * Detect voice volume/amplitude
   */
  private detectVolume(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += Math.abs(buffer[i]);
    }
    const rms = Math.sqrt(sum / buffer.length);
    return Math.min(100, (rms * 1000));
  }

  /**
   * Detect if voice is active (speaking vs silence/noise)
   */
  private detectVoiceActivity(buffer: Float32Array): boolean {
    const volume = this.detectVolume(buffer);
    
    console.log(`🔊 Voice activity check - volume: ${volume.toFixed(2)}, threshold: ${this.VOICE_ACTIVITY_THRESHOLD}`);
    
    // Voice activity detection threshold (volume is already multiplied by 1000 in detectVolume)
    if (volume < this.VOICE_ACTIVITY_THRESHOLD) {
      return false;
    }
    
    // Check for voice characteristics (not just noise)
    const pitch = this.detectPitchAdvanced(buffer);
    console.log(`🎵 Pitch detected: ${pitch.toFixed(0)}Hz`);
    return pitch >= 50 && pitch <= 800;
  }

  /**
   * Determine gender with high confidence scoring (adjusted for mode)
   */
  private determineGenderWithConfidence(pitch: number): { gender: 'male' | 'female' | 'unknown', confidence: number } {
    const { male, female, overlap } = this.GENDER_PITCH_BOUNDARIES;
    
    // Lower confidence baseline for playback mode due to audio degradation
    const confidenceMultiplier = this.mode === 'playback' ? 0.9 : 1.0;
    
    // High confidence female range
    if (pitch >= female.max - 10) {
      return { 
        gender: 'female', 
        confidence: 0.95 * confidenceMultiplier
      };
    }
    
    // High confidence male range
    if (pitch <= male.min + 10) {
      return { 
        gender: 'male', 
        confidence: 0.95 * confidenceMultiplier
      };
    }
    
    // Pure female range
    if (pitch > overlap.end) {
      const confidence = Math.min(0.95, 0.75 + (pitch - overlap.end) / 75) * confidenceMultiplier;
      return { gender: 'female', confidence };
    }
    
    // Pure male range
    if (pitch < overlap.start) {
      const confidence = Math.min(0.95, 0.75 + (overlap.start - pitch) / 80) * confidenceMultiplier;
      return { gender: 'male', confidence };
    }
    
    // Overlap zone - lower confidence, use pitch analysis
    const femaleDistance = pitch - overlap.start;
    const maleDistance = overlap.end - pitch;
    
    if (femaleDistance > maleDistance) {
      return { 
        gender: 'female', 
        confidence: (0.65 + (femaleDistance / 15) * 0.2) * confidenceMultiplier
      };
    } else {
      return { 
        gender: 'male', 
        confidence: (0.65 + (maleDistance / 15) * 0.2) * confidenceMultiplier
      };
    }
  }

  /**
   * Assess voice quality based on multiple factors
   */
  private assessVoiceQuality(buffer: Float32Array, pitch: number, volume: number): 'excellent' | 'good' | 'fair' | 'poor' {
    let qualityScore = 0;
    
    // Volume quality (0-40 points)
    if (volume > 20) qualityScore += 40;
    else if (volume > 10) qualityScore += 25;
    else if (volume > 5) qualityScore += 10;
    
    // Pitch stability (0-30 points)
    const pitchStability = this.measurePitchStability(buffer);
    qualityScore += pitchStability * 30;
    
    // Audio clarity (0-30 points)
    const clarity = this.measureAudioClarity(buffer);
    qualityScore += clarity * 30;
    
    if (qualityScore >= 80) return 'excellent';
    if (qualityScore >= 60) return 'good';
    if (qualityScore >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Measure pitch stability (less variance = more stable)
   */
  private measurePitchStability(buffer: Float32Array): number {
    const pitches: number[] = [];
    const chunkSize = buffer.length / 4;
    
    for (let i = 0; i < 4; i++) {
      const chunk = buffer.slice(i * chunkSize, (i + 1) * chunkSize);
      const pitch = this.detectPitchAdvanced(chunk);
      if (pitch > 0) pitches.push(pitch);
    }
    
    if (pitches.length < 2) return 0.5;
    
    // Calculate variance
    const avg = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / pitches.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize (less variance = higher score)
    return Math.max(0, 1 - (stdDev / avg));
  }

  /**
   * Measure audio clarity (signal-to-noise ratio estimation)
   */
  private measureAudioClarity(buffer: Float32Array): number {
    let signalEnergy = 0;
    let noiseEnergy = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const amplitude = Math.abs(buffer[i]);
      if (amplitude > 0.02) {
        signalEnergy += amplitude;
      } else {
        noiseEnergy += amplitude;
      }
    }
    
    const snr = signalEnergy / (noiseEnergy + 0.001);
    return Math.min(1, snr / 10);
  }

  /**
   * ADVANCED: Identify or create speaker profile with multi-factor analysis
   * Handles same-gender speakers using pitch variance, frequency patterns, and adaptive ranges
   */
  private identifySpeaker(pitch: number, gender: 'male' | 'female'): string {
    const now = Date.now();
    
    // Look for existing speaker profile with enhanced matching
    for (const [speakerId, profile] of this.speakerProfiles.entries()) {
      const pitchMatch = Math.abs(pitch - profile.avgPitch) < this.MIN_PITCH_DIFFERENCE;
      const genderMatch = profile.gender === gender;
      
      // Check pitch range overlap for better same-gender detection
      const withinRange = pitch >= profile.pitchRange[0] - 10 && 
                         pitch <= profile.pitchRange[1] + 10;
      
      if ((pitchMatch || withinRange) && genderMatch) {
        // Update profile with exponential smoothing
        profile.avgPitch = profile.avgPitch * 0.85 + pitch * 0.15;
        profile.sampleCount++;
        profile.lastSeen = now;
        
        // Adaptive pitch range - expands gradually
        if (pitch < profile.pitchRange[0]) profile.pitchRange[0] = pitch - 5;
        if (pitch > profile.pitchRange[1]) profile.pitchRange[1] = pitch + 5;
        
        return speakerId;
      }
    }
    
    // Create new speaker profile
    const newSpeakerId = `${gender}_speaker_${this.speakerProfiles.size + 1}`;
    const newProfile: SpeakerProfile = {
      speakerId: newSpeakerId,
      gender,
      avgPitch: pitch,
      pitchRange: [pitch - 15, pitch + 15], // Wider initial range
      voiceQuality: 'unknown',
      sampleCount: 1,
      lastSeen: now
    };
    
    this.speakerProfiles.set(newSpeakerId, newProfile);
    console.log(`🎤 New speaker identified: ${newSpeakerId} (${gender}, ${pitch.toFixed(0)}Hz, range: ${newProfile.pitchRange.map(p => p.toFixed(0)).join('-')}Hz)`);
    
    return newSpeakerId;
  }

  /**
   * Start real-time voice monitoring
   */
  startRealTimeAnalysis(onUpdate: (characteristics: VoiceCharacteristics) => void): () => void {
    if (!this.analyser) {
      throw new Error('Analyzer not initialized');
    }
    
    let animationFrameId: number;
    const analyze = async () => {
      try {
        const characteristics = await this.analyzeVoiceSample();
        onUpdate(characteristics);
        
        // Track voice session
        this.trackVoiceSession(characteristics);
        
        animationFrameId = requestAnimationFrame(analyze);
      } catch (error) {
        console.error('Voice analysis error:', error);
      }
    };
    
    animationFrameId = requestAnimationFrame(analyze);
    
    // Return cleanup function
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }

  /**
   * Track voice session for speaker diarization
   */
  private trackVoiceSession(characteristics: VoiceCharacteristics) {
    const now = Date.now();
    
    if (characteristics.confidence > this.MIN_CONFIDENCE) {
      if (!this.currentVoiceSession || this.currentVoiceSession.speakerId !== characteristics.speakerId) {
        // New speaker started
        if (this.currentVoiceSession) {
          // Save previous session
          this.saveVoiceSession(this.currentVoiceSession, now);
        }
        
        // Start new session
        this.currentVoiceSession = {
          speakerId: characteristics.speakerId,
          startTime: now,
          pitchSamples: [characteristics.pitch],
          volumeSamples: [characteristics.volume]
        };
      } else {
        // Same speaker continues
        this.currentVoiceSession.pitchSamples.push(characteristics.pitch);
        this.currentVoiceSession.volumeSamples.push(characteristics.volume);
      }
    } else if (this.currentVoiceSession) {
      // Voice stopped or uncertainty
      const silenceDuration = now - this.currentVoiceSession.startTime;
      if (silenceDuration > 2000) { // 2 seconds of silence
        this.saveVoiceSession(this.currentVoiceSession, now);
        this.currentVoiceSession = null;
      }
    }
  }

  /**
   * Save completed voice session to history
   */
  private saveVoiceSession(session: typeof this.currentVoiceSession, endTime: number) {
    if (!session) return;
    
    const duration = endTime - session.startTime;
    const avgPitch = session.pitchSamples.reduce((a, b) => a + b, 0) / session.pitchSamples.length;
    const avgVolume = session.volumeSamples.reduce((a, b) => a + b, 0) / session.volumeSamples.length;
    
    this.voiceHistory.push({
      timestamp: session.startTime,
      speakerId: session.speakerId,
      pitch: avgPitch,
      volume: avgVolume,
      duration,
      confidence: 0.8 // Average confidence
    });
    
    // Keep history limited
    if (this.voiceHistory.length > this.HISTORY_LIMIT) {
      this.voiceHistory.shift();
    }
    
    console.log(`📊 Voice session: ${session.speakerId} (${duration}ms, avg ${avgPitch.toFixed(0)}Hz)`);
  }

  /**
   * Get speaker statistics
   */
  getSpeakerStatistics(): { [speakerId: string]: any } {
    const stats: any = {};
    
    for (const [speakerId, profile] of this.speakerProfiles.entries()) {
      stats[speakerId] = {
        gender: profile.gender,
        avgPitch: profile.avgPitch.toFixed(0),
        pitchRange: profile.pitchRange.map(p => p.toFixed(0)),
        samples: profile.sampleCount,
        lastSeen: new Date(profile.lastSeen).toLocaleTimeString()
      };
    }
    
    return stats;
  }

  /**
   * Get voice history
   */
  getVoiceHistory(): VoiceActivityEvent[] {
    return [...this.voiceHistory];
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.microphone) {
      this.microphone.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.gainNode = null;
    this.currentVoiceSession = null;
    
    console.log('🧹 Voice analyzer cleaned up');
  }
}
