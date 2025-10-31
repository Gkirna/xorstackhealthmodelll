/**
 * Ultra-Advanced Voice Analyzer with ML Integration
 * Combines traditional audio analysis with AI-powered speaker detection
 */

import { VoiceAnalyzer, VoiceCharacteristics, SpeakerProfile } from './VoiceAnalyzer';
import { supabase } from '@/integrations/supabase/client';

export interface AdvancedSpeakerProfile extends SpeakerProfile {
  emotionState?: {
    primary: string;
    intensity: number;
    confidence: number;
  };
  stressLevel?: number;
  speechPattern?: {
    avgPause: number;
    speechRate: number; // words per minute
    articulation: number; // clarity score
  };
  identityConfidence?: number;
  pitchStats: {
    variance: number;
    mean: number;
  };
}

export interface TemporalPattern {
  timestamp: number;
  characteristics: VoiceCharacteristics;
  contextWindow: VoiceCharacteristics[]; // Previous 5 samples for pattern detection
}

export class UltraAdvancedVoiceAnalyzer extends VoiceAnalyzer {
  private temporalHistory: TemporalPattern[] = [];
  private advancedSpeakerProfiles: Map<string, AdvancedSpeakerProfile> = new Map();
  private mlModelReady: boolean = false;
  private contextWindowSize: number = 5;
  private confidenceThreshold: number = 0.75;

  constructor() {
    super();
    this.initializeMLModels();
  }

  private async initializeMLModels() {
    console.log('🧠 Initializing ML models for ultra-advanced analysis...');
    // ML models are handled by AssemblyAI and OpenAI APIs
    this.mlModelReady = true;
    console.log('✅ ML models ready');
  }

  /**
   * Enhanced voice analysis with temporal context
   */
  public async analyzeWithTemporalContext(): Promise<VoiceCharacteristics> {
    const characteristics = await this.analyzeVoiceSample();
    
    // Build context window
    const contextWindow = this.temporalHistory
      .slice(-this.contextWindowSize)
      .map(t => t.characteristics);

    const temporalPattern: TemporalPattern = {
      timestamp: Date.now(),
      characteristics,
      contextWindow,
    };

    this.temporalHistory.push(temporalPattern);

    // Detect patterns in temporal data
    if (contextWindow.length >= this.contextWindowSize) {
      this.detectTemporalPatterns(characteristics, contextWindow);
    }

    return characteristics;
  }

  /**
   * Detect patterns across time windows
   */
  private detectTemporalPatterns(
    current: VoiceCharacteristics, 
    history: VoiceCharacteristics[]
  ) {
    // Calculate pitch stability over time
    const pitchVariance = this.calculateVariance(history.map(h => h.pitch));
    
    // Detect emotional shifts (sudden pitch/volume changes)
    const volumeVariance = this.calculateVariance(history.map(h => h.volume));
    
    // Detect stress indicators (increased pitch + volume variability)
    const stressIndicator = pitchVariance > 50 && volumeVariance > 0.15;

    if (stressIndicator) {
      console.log('⚠️ Stress detected in voice pattern');
    }

    // Update speaker profile with advanced metrics
    if (current.speakerId) {
      const profile = this.advancedSpeakerProfiles.get(current.speakerId);
      if (profile) {
        profile.stressLevel = stressIndicator ? 
          Math.min(10, (profile.stressLevel || 0) + 1) : 
          Math.max(0, (profile.stressLevel || 0) - 0.5);
      }
    }
  }

  /**
   * Advanced speaker identification with ML confidence scoring
   */
  public async identifySpeakerAdvanced(
    characteristics: VoiceCharacteristics,
    contextualClues?: { previousSpeaker?: string; pauseDuration?: number }
  ): Promise<{ speakerId: string; confidence: number }> {
    // Use base class speaker identification
    const speakerId = characteristics.gender !== 'unknown' 
      ? this.identifySpeaker(characteristics.pitch, characteristics.gender)
      : `speaker_${Math.floor(characteristics.pitch / 50)}`;
    
    // Enhance with contextual analysis
    let confidence = characteristics.confidence;

    if (contextualClues?.previousSpeaker === speakerId && contextualClues.pauseDuration < 500) {
      // Same speaker continuing - boost confidence
      confidence = Math.min(1.0, confidence * 1.2);
    } else if (contextualClues?.pauseDuration && contextualClues.pauseDuration > 2000) {
      // Long pause indicates speaker change - adjust confidence
      confidence = Math.max(0.5, confidence * 0.9);
    }

    // Update advanced profile
    if (!this.advancedSpeakerProfiles.has(speakerId)) {
      const baseProfile = this.getSpeakerStatistics()[speakerId];
      if (baseProfile) {
        this.advancedSpeakerProfiles.set(speakerId, {
          ...baseProfile,
          identityConfidence: confidence,
          stressLevel: 5, // neutral
          speechPattern: {
            avgPause: contextualClues?.pauseDuration || 0,
            speechRate: 150, // default WPM
            articulation: 0.8,
          },
          pitchStats: {
            variance: 0,
            mean: baseProfile.avgPitch,
          }
        });
      }
    }

    return { speakerId, confidence };
  }

  /**
   * Behavioral pattern detection from voice characteristics
   */
  public detectBehavioralPatterns(speakerId: string): {
    isConfident: boolean;
    isHesitant: boolean;
    isEmotional: boolean;
    engagementLevel: number;
  } {
    const profile = this.advancedSpeakerProfiles.get(speakerId);
    if (!profile) {
      return { 
        isConfident: false, 
        isHesitant: false, 
        isEmotional: false, 
        engagementLevel: 5 
      };
    }

    const pitchVariance = profile.pitchStats?.variance || 0;
    const avgVolume = this.temporalHistory
      .filter(t => t.characteristics.speakerId === speakerId)
      .reduce((sum, t) => sum + t.characteristics.volume, 0) / this.temporalHistory.length;

    return {
      isConfident: avgVolume > 0.6 && pitchVariance < 30,
      isHesitant: pitchVariance > 60 || avgVolume < 0.3,
      isEmotional: pitchVariance > 80 || profile.stressLevel! > 7,
      engagementLevel: Math.round((avgVolume + (1 - pitchVariance / 100)) * 5),
    };
  }

  /**
   * Analyze conversation dynamics
   */
  public analyzeConversationDynamics(): {
    turnTakingPattern: string;
    dominantSpeaker?: string;
    interactionQuality: number;
  } {
    const speakerTurns = new Map<string, number>();
    let previousSpeaker: string | null = null;
    let turnChanges = 0;

    this.temporalHistory.forEach(pattern => {
      const currentSpeaker = pattern.characteristics.speakerId;
      if (currentSpeaker) {
        speakerTurns.set(currentSpeaker, (speakerTurns.get(currentSpeaker) || 0) + 1);
        
        if (previousSpeaker && previousSpeaker !== currentSpeaker) {
          turnChanges++;
        }
        previousSpeaker = currentSpeaker;
      }
    });

    // Find dominant speaker
    let dominantSpeaker: string | undefined;
    let maxTurns = 0;
    speakerTurns.forEach((turns, speaker) => {
      if (turns > maxTurns) {
        maxTurns = turns;
        dominantSpeaker = speaker;
      }
    });

    // Determine pattern
    const avgTurnsPerSpeaker = Array.from(speakerTurns.values())
      .reduce((sum, t) => sum + t, 0) / speakerTurns.size;
    
    let turnTakingPattern = 'balanced';
    if (maxTurns > avgTurnsPerSpeaker * 2) {
      turnTakingPattern = 'dominated';
    } else if (turnChanges > this.temporalHistory.length * 0.4) {
      turnTakingPattern = 'rapid-fire';
    } else if (turnChanges < this.temporalHistory.length * 0.1) {
      turnTakingPattern = 'monologue';
    }

    // Calculate interaction quality (balanced turn-taking = higher quality)
    const balance = 1 - Math.abs(0.5 - (maxTurns / this.temporalHistory.length));
    const interactionQuality = Math.round(balance * 10);

    return {
      turnTakingPattern,
      dominantSpeaker,
      interactionQuality,
    };
  }

  /**
   * Confidence-based segment flagging for re-analysis
   */
  public identifyLowConfidenceSegments(): Array<{
    timestamp: number;
    characteristics: VoiceCharacteristics;
    reason: string;
  }> {
    return this.temporalHistory
      .filter(pattern => pattern.characteristics.confidence < this.confidenceThreshold)
      .map(pattern => ({
        timestamp: pattern.timestamp,
        characteristics: pattern.characteristics,
        reason: this.diagnoseConfidenceIssue(pattern),
      }));
  }

  private diagnoseConfidenceIssue(pattern: TemporalPattern): string {
    const c = pattern.characteristics;
    const reasons: string[] = [];

    if (c.volume < 0.2) reasons.push('low volume');
    const qualityScore = c.voiceQuality === 'excellent' ? 1.0 : c.voiceQuality === 'good' ? 0.7 : c.voiceQuality === 'fair' ? 0.5 : 0.3;
    if (qualityScore < 0.5) reasons.push('poor audio quality');
    const pitchNum = typeof c.pitch === 'number' ? c.pitch : 150;
    if (pitchNum < 80 || pitchNum > 400) reasons.push('unusual pitch range');
    
    const pitchVariance = this.calculateVariance(
      pattern.contextWindow.map(w => w.pitch)
    );
    if (pitchVariance > 100) reasons.push('high pitch instability');

    return reasons.length > 0 ? reasons.join(', ') : 'unknown factor';
  }

  /**
   * Request AI-powered re-analysis for low confidence segments
   */
  public async requestAIReanalysis(
    lowConfidenceSegments: Array<{ timestamp: number; characteristics: VoiceCharacteristics }>,
    audioContext?: { segments: any[]; transcript: string }
  ): Promise<any[]> {
    if (!audioContext) return [];

    try {
      console.log(`🔄 Requesting AI re-analysis for ${lowConfidenceSegments.length} segments`);

      const { data, error } = await supabase.functions.invoke('ultra-advanced-analysis', {
        body: {
          transcript: audioContext.transcript,
          segments: audioContext.segments,
          lowConfidenceTimestamps: lowConfidenceSegments.map(s => s.timestamp),
        }
      });

      if (error) throw error;

      console.log('✅ AI re-analysis completed');
      return data.analysis?.reanalyzedChunks || [];
    } catch (error) {
      console.error('❌ AI re-analysis failed:', error);
      return [];
    }
  }

  /**
   * Get comprehensive speaker analytics
   */
  public getAdvancedSpeakerAnalytics(speakerId: string) {
    const profile = this.advancedSpeakerProfiles.get(speakerId);
    const behavioral = this.detectBehavioralPatterns(speakerId);
    const baseStats = this.getSpeakerStatistics()[speakerId];

    return {
      ...baseStats,
      ...profile,
      behavioral,
      temporalDataPoints: this.temporalHistory.filter(
        t => t.characteristics.speakerId === speakerId
      ).length,
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  public getTemporalHistory() {
    return this.temporalHistory;
  }

  public clearHistory() {
    this.temporalHistory = [];
    this.advancedSpeakerProfiles.clear();
  }

  public override cleanup() {
    this.clearHistory();
    super.cleanup();
  }
}
