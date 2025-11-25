/**
 * Advanced Speaker Diarization System
 * Provides sophisticated speaker detection, labeling, and profile management
 */

import { VoiceCharacteristics } from './VoiceAnalyzer';

export interface SpeakerProfile {
  id: string;
  label: 'doctor' | 'patient' | 'unknown';
  confidence: number;
  voiceSignature: {
    avgPitch: number;
    pitchRange: [number, number];
    gender: 'male' | 'female' | 'unknown';
    voiceQuality: string;
    volumePattern: number[];
  };
  speakingPatterns: {
    avgDuration: number;
    pausePattern: number[];
    turnFrequency: number;
  };
  sampleCount: number;
  lastUpdated: number;
}

export interface DiarizedSegment {
  speaker: 'doctor' | 'patient';
  text: string;
  confidence: number;
  timestamp: number;
  voiceCharacteristics?: VoiceCharacteristics;
}

export class AdvancedSpeakerDiarization {
  private speakerProfiles: Map<string, SpeakerProfile> = new Map();
  private segmentHistory: DiarizedSegment[] = [];
  private currentSpeaker: 'doctor' | 'patient' = 'doctor';
  private lastSegmentTime: number = 0;
  private doctorProfileId: string | null = null;
  private patientProfileId: string | null = null;

  // Configuration
  private readonly SPEAKER_SWITCH_THRESHOLD_MS = 2000; // 2 seconds silence = likely speaker change
  private readonly MIN_CONFIDENCE_FOR_AUTO_LABEL = 0.65;
  private readonly PITCH_DIFFERENCE_THRESHOLD = 40; // Hz difference to consider different speakers
  
  /**
   * Process a transcript segment with voice characteristics
   */
  processSpeechSegment(
    text: string,
    voiceCharacteristics: VoiceCharacteristics | null,
    timestamp: number
  ): DiarizedSegment {
    const timeSinceLastSegment = timestamp - this.lastSegmentTime;
    
    // Determine speaker based on multiple factors
    const speakerDecision = this.determineSpeaker(
      voiceCharacteristics,
      timeSinceLastSegment,
      text
    );

    const segment: DiarizedSegment = {
      speaker: speakerDecision.speaker,
      text,
      confidence: speakerDecision.confidence,
      timestamp,
      voiceCharacteristics: voiceCharacteristics || undefined,
    };

    // Update profiles if we have voice characteristics
    if (voiceCharacteristics) {
      this.updateSpeakerProfile(speakerDecision.speaker, voiceCharacteristics, timestamp);
    }

    this.segmentHistory.push(segment);
    this.currentSpeaker = speakerDecision.speaker;
    this.lastSegmentTime = timestamp;

    console.log(`🎯 Diarization: ${speakerDecision.speaker.toUpperCase()} (confidence: ${(speakerDecision.confidence * 100).toFixed(0)}%)`, {
      pitch: voiceCharacteristics?.pitch,
      gender: voiceCharacteristics?.gender,
      quality: voiceCharacteristics?.voiceQuality,
      timeSinceLastSegment: `${timeSinceLastSegment}ms`
    });

    return segment;
  }

  /**
   * Determine speaker using multiple signals
   */
  private determineSpeaker(
    voice: VoiceCharacteristics | null,
    timeSinceLastSegment: number,
    text: string
  ): { speaker: 'doctor' | 'patient'; confidence: number } {
    // Factor 1: Voice characteristics matching
    let voiceMatchScore = 0;
    let matchedSpeaker: 'doctor' | 'patient' | null = null;

    if (voice && voice.confidence > 0.5) {
      const doctorMatch = this.matchVoiceToProfile(voice, this.doctorProfileId);
      const patientMatch = this.matchVoiceToProfile(voice, this.patientProfileId);

      if (doctorMatch.confidence > patientMatch.confidence && doctorMatch.confidence > 0.6) {
        voiceMatchScore = doctorMatch.confidence;
        matchedSpeaker = 'doctor';
      } else if (patientMatch.confidence > 0.6) {
        voiceMatchScore = patientMatch.confidence;
        matchedSpeaker = 'patient';
      }
    }

    // Factor 2: Time-based speaker switching (silence indicates turn-taking)
    const shouldSwitchBasedOnTime = timeSinceLastSegment > this.SPEAKER_SWITCH_THRESHOLD_MS;

    // Factor 3: Linguistic patterns (doctors use more medical terminology)
    const linguisticScore = this.analyzeLinguisticPatterns(text);

    // Factor 4: Conversation flow (alternating pattern)
    const flowScore = this.analyzeConversationFlow();

    // Combine all factors
    if (voiceMatchScore > 0.7) {
      // High confidence voice match - trust it
      return { 
        speaker: matchedSpeaker!, 
        confidence: voiceMatchScore 
      };
    }

    if (shouldSwitchBasedOnTime) {
      // Likely speaker change due to pause
      const newSpeaker = this.currentSpeaker === 'doctor' ? 'patient' : 'doctor';
      const confidence = 0.65 + (voiceMatchScore * 0.2) + (linguisticScore * 0.15);
      return { speaker: newSpeaker, confidence };
    }

    // Continue with current speaker if no strong signal to switch
    const confidence = 0.55 + (voiceMatchScore * 0.25) + (flowScore * 0.2);
    return { speaker: this.currentSpeaker, confidence };
  }

  /**
   * Match voice characteristics to an existing profile
   */
  private matchVoiceToProfile(
    voice: VoiceCharacteristics,
    profileId: string | null
  ): { confidence: number } {
    if (!profileId || !this.speakerProfiles.has(profileId)) {
      return { confidence: 0 };
    }

    const profile = this.speakerProfiles.get(profileId)!;
    let matchScore = 0;
    let factors = 0;

    // Pitch matching
    const pitchDiff = Math.abs(voice.pitch - profile.voiceSignature.avgPitch);
    if (pitchDiff < this.PITCH_DIFFERENCE_THRESHOLD) {
      matchScore += (1 - pitchDiff / this.PITCH_DIFFERENCE_THRESHOLD);
      factors++;
    }

    // Gender matching
    if (voice.gender === profile.voiceSignature.gender) {
      matchScore += 1;
      factors++;
    }

    // Voice quality matching (string comparison)
    if (voice.voiceQuality === profile.voiceSignature.voiceQuality) {
      matchScore += 1;
      factors++;
    }

    const confidence = factors > 0 ? matchScore / factors : 0;
    return { confidence: Math.min(confidence * voice.confidence, 1.0) };
  }

  /**
   * Update speaker profile with new voice data
   */
  private updateSpeakerProfile(
    speaker: 'doctor' | 'patient',
    voice: VoiceCharacteristics,
    timestamp: number
  ) {
    const profileId = speaker === 'doctor' ? this.doctorProfileId : this.patientProfileId;

    if (!profileId || !this.speakerProfiles.has(profileId)) {
      // Create new profile
      const newProfileId = `${speaker}-${Date.now()}`;
      const newProfile: SpeakerProfile = {
        id: newProfileId,
        label: speaker,
        confidence: voice.confidence,
        voiceSignature: {
          avgPitch: voice.pitch,
          pitchRange: [voice.pitch - 10, voice.pitch + 10],
          gender: voice.gender,
          voiceQuality: voice.voiceQuality,
          volumePattern: [voice.volume],
        },
        speakingPatterns: {
          avgDuration: 0,
          pausePattern: [],
          turnFrequency: 0,
        },
        sampleCount: 1,
        lastUpdated: timestamp,
      };

      this.speakerProfiles.set(newProfileId, newProfile);
      
      if (speaker === 'doctor') {
        this.doctorProfileId = newProfileId;
      } else {
        this.patientProfileId = newProfileId;
      }

      console.log(`✨ Created new ${speaker} profile:`, { id: newProfileId, pitch: voice.pitch, gender: voice.gender });
    } else {
      // Update existing profile with exponential moving average
      const profile = this.speakerProfiles.get(profileId)!;
      const alpha = 0.2; // Learning rate

      profile.voiceSignature.avgPitch = 
        alpha * voice.pitch + (1 - alpha) * profile.voiceSignature.avgPitch;
      
      profile.voiceSignature.pitchRange = [
        Math.min(profile.voiceSignature.pitchRange[0], voice.pitch),
        Math.max(profile.voiceSignature.pitchRange[1], voice.pitch),
      ];

      // Update voice quality (keep most recent)
      profile.voiceSignature.voiceQuality = voice.voiceQuality;
      
      profile.voiceSignature.volumePattern.push(voice.volume);
      if (profile.voiceSignature.volumePattern.length > 20) {
        profile.voiceSignature.volumePattern.shift();
      }

      profile.sampleCount++;
      profile.confidence = Math.min(profile.confidence + 0.01, 0.95);
      profile.lastUpdated = timestamp;

      console.log(`🔄 Updated ${speaker} profile: samples=${profile.sampleCount}, confidence=${(profile.confidence * 100).toFixed(0)}%`);
    }
  }

  /**
   * Analyze linguistic patterns in text
   */
  private analyzeLinguisticPatterns(text: string): number {
    const medicalTerms = [
      'patient', 'symptom', 'diagnosis', 'treatment', 'prescription',
      'medical', 'condition', 'history', 'exam', 'assessment', 'plan',
      'medication', 'dose', 'mg', 'ml', 'bp', 'temperature', 'pain',
      'chronic', 'acute', 'therapy', 'follow-up', 'test', 'lab', 'report'
    ];

    const lowerText = text.toLowerCase();
    let medicalTermCount = 0;

    for (const term of medicalTerms) {
      if (lowerText.includes(term)) {
        medicalTermCount++;
      }
    }

    // More medical terms = more likely to be doctor
    return Math.min(medicalTermCount / 5, 1.0);
  }

  /**
   * Analyze conversation flow patterns
   */
  private analyzeConversationFlow(): number {
    if (this.segmentHistory.length < 3) return 0.5;

    const recentSegments = this.segmentHistory.slice(-5);
    let alternationCount = 0;

    for (let i = 1; i < recentSegments.length; i++) {
      if (recentSegments[i].speaker !== recentSegments[i - 1].speaker) {
        alternationCount++;
      }
    }

    // Natural conversation alternates speakers
    return alternationCount / (recentSegments.length - 1);
  }

  /**
   * Get formatted transcript with speaker labels
   */
  getFormattedTranscript(): string {
    const lines: string[] = [];
    let currentSpeaker: 'doctor' | 'patient' | null = null;
    let currentBlock: string[] = [];

    for (const segment of this.segmentHistory) {
      if (segment.speaker !== currentSpeaker) {
        // Speaker changed - output previous block
        if (currentBlock.length > 0 && currentSpeaker) {
          const label = currentSpeaker === 'doctor' ? 'Doctor' : 'Patient';
          lines.push(`${label}: ${currentBlock.join(' ')}`);
          currentBlock = [];
        }
        currentSpeaker = segment.speaker;
      }
      currentBlock.push(segment.text.trim());
    }

    // Output final block
    if (currentBlock.length > 0 && currentSpeaker) {
      const label = currentSpeaker === 'doctor' ? 'Doctor' : 'Patient';
      lines.push(`${label}: ${currentBlock.join(' ')}`);
    }

    return lines.join('\n\n');
  }

  /**
   * Get speaker statistics
   */
  getSpeakerStatistics() {
    const doctorSegments = this.segmentHistory.filter(s => s.speaker === 'doctor');
    const patientSegments = this.segmentHistory.filter(s => s.speaker === 'patient');

    return {
      totalSegments: this.segmentHistory.length,
      doctorSegments: doctorSegments.length,
      patientSegments: patientSegments.length,
      avgDoctorConfidence: 
        doctorSegments.reduce((sum, s) => sum + s.confidence, 0) / Math.max(doctorSegments.length, 1),
      avgPatientConfidence: 
        patientSegments.reduce((sum, s) => sum + s.confidence, 0) / Math.max(patientSegments.length, 1),
      doctorProfile: this.doctorProfileId ? this.speakerProfiles.get(this.doctorProfileId) : null,
      patientProfile: this.patientProfileId ? this.speakerProfiles.get(this.patientProfileId) : null,
    };
  }

  /**
   * Reset diarization state
   */
  reset() {
    this.speakerProfiles.clear();
    this.segmentHistory = [];
    this.currentSpeaker = 'doctor';
    this.lastSegmentTime = 0;
    this.doctorProfileId = null;
    this.patientProfileId = null;
    console.log('🔄 Speaker diarization system reset');
  }

  /**
   * Export diarization data
   */
  exportData() {
    return {
      profiles: Array.from(this.speakerProfiles.entries()),
      segments: this.segmentHistory,
      statistics: this.getSpeakerStatistics(),
    };
  }
}
