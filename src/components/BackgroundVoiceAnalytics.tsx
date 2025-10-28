/**
 * Background Voice Analytics Service
 * Runs all voice analytics features without UI display
 */

import { useEffect, useRef, useState } from 'react';
import { VoiceAnalyzer } from '@/utils/VoiceAnalyzer';

interface BackgroundVoiceAnalyticsProps {
  voiceAnalyzer: any;
  isActive: boolean;
}

interface BackgroundMetrics {
  currentPitch: number;
  currentVolume: number;
  currentEmotion: string;
  currentStress: number;
  currentSpeaker: string;
  confidence: number;
  voiceQuality: string;
  speakingRate: number;
  authenticityScore: number;
  spoofingRisk: number;
  cognitiveLoad: number;
  deceptionIndicators: number;
  quantumCoherence: number;
  biometricMatch: number;
  personalityOpenness: number;
  healthVitality: number;
}

export function BackgroundVoiceAnalytics({ 
  voiceAnalyzer, 
  isActive 
}: BackgroundVoiceAnalyticsProps) {
  const [metrics, setMetrics] = useState<BackgroundMetrics>({
    currentPitch: 0,
    currentVolume: 0,
    currentEmotion: 'neutral',
    currentStress: 0,
    currentSpeaker: 'unknown',
    confidence: 0,
    voiceQuality: 'poor',
    speakingRate: 0,
    authenticityScore: 0,
    spoofingRisk: 0,
    cognitiveLoad: 0,
    deceptionIndicators: 0,
    quantumCoherence: 0,
    biometricMatch: 0,
    personalityOpenness: 0,
    healthVitality: 0,
  });

  const [speakerStats, setSpeakerStats] = useState<any>({});
  const [emotionDistribution, setEmotionDistribution] = useState<any>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time data updates - runs in background
  useEffect(() => {
    if (!isActive || !voiceAnalyzer) return;

    console.log('🔬 Background Voice Analytics: Starting silent monitoring...');

    // Start background monitoring
    intervalRef.current = setInterval(() => {
      if (voiceAnalyzer && voiceAnalyzer.isActive()) {
        try {
          // Get all voice analysis data
          const currentPitch = voiceAnalyzer.getCurrentPitch() || 0;
          const currentVolume = voiceAnalyzer.getCurrentVolume() || 0;
          const currentGender = voiceAnalyzer.getCurrentGender() || 'unknown';
          const voiceQuality = voiceAnalyzer.getVoiceQuality() || 'poor';
          const speakerStats = voiceAnalyzer.getSpeakerStats() || {};
          
          // Calculate advanced metrics (same as UI version)
          const emotion = calculateEmotion(currentPitch, currentVolume, voiceQuality);
          const stress = calculateStress(currentPitch, currentVolume);
          const confidence = calculateConfidence(voiceQuality, currentVolume);
          const speakingRate = calculateSpeakingRate(speakerStats);
          const authenticityScore = calculateAuthenticity(currentPitch, currentVolume, voiceQuality);
          const spoofingRisk = calculateSpoofingRisk(currentPitch, currentVolume, voiceQuality);
          const cognitiveLoad = calculateCognitiveLoad(currentPitch, currentVolume, speakingRate);
          const deceptionIndicators = calculateDeceptionIndicators(currentPitch, currentVolume, stress);
          const quantumCoherence = calculateQuantumCoherence(currentPitch, currentVolume);
          const biometricMatch = calculateBiometricMatch(currentPitch, currentVolume, currentGender);
          const personalityOpenness = calculatePersonalityOpenness(currentPitch, currentVolume, speakingRate);
          const healthVitality = calculateHealthVitality(currentPitch, currentVolume, voiceQuality);

          // Update metrics silently
          setMetrics(prev => ({
            ...prev,
            currentPitch,
            currentVolume,
            currentEmotion: emotion,
            currentStress: stress,
            currentSpeaker: currentGender,
            confidence,
            voiceQuality,
            speakingRate,
            authenticityScore,
            spoofingRisk,
            cognitiveLoad,
            deceptionIndicators,
            quantumCoherence,
            biometricMatch,
            personalityOpenness,
            healthVitality,
          }));

          // Update speaker statistics
          setSpeakerStats(speakerStats);

          // Update emotion distribution
          setEmotionDistribution(prev => ({
            ...prev,
            [emotion]: (prev[emotion] || 0) + 1
          }));

          // Store analytics data in sessionStorage for potential access by other components
          try {
            sessionStorage.setItem('backgroundVoiceAnalytics', JSON.stringify({
              timestamp: Date.now(),
              metrics: {
                currentPitch,
                currentVolume,
                currentEmotion: emotion,
                currentStress: stress,
                currentSpeaker: currentGender,
                confidence,
                voiceQuality,
                speakingRate,
                authenticityScore,
                spoofingRisk,
                cognitiveLoad,
                deceptionIndicators,
                quantumCoherence,
                biometricMatch,
                personalityOpenness,
                healthVitality,
              },
              speakerStats,
              emotionDistribution: {
                ...emotionDistribution,
                [emotion]: (emotionDistribution[emotion] || 0) + 1
              }
            }));
          } catch (e) {
            // Ignore sessionStorage errors
          }

          // Log key metrics for debugging (can be removed in production)
          if (Math.random() < 0.05) { // Log only 5% of updates to reduce noise
            console.log('🔬 Background Analytics:', {
              pitch: Math.round(currentPitch),
              volume: Math.round(currentVolume),
              emotion,
              stress: Math.round(stress),
              quality: voiceQuality,
              confidence: Math.round(confidence)
            });
          }

        } catch (error) {
          console.error('❌ Background Voice Analytics Error:', error);
        }
      }
    }, 1000); // Update every second

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('🔬 Background Voice Analytics: Stopped monitoring');
      }
    };
  }, [isActive, voiceAnalyzer, emotionDistribution]);

  // Advanced calculation functions (same as UI version)
  const calculateEmotion = (pitch: number, volume: number, quality: string): string => {
    const pitchScore = Math.min(Math.max((pitch - 100) / 100, 0), 1);
    const volumeScore = Math.min(Math.max(volume / 100, 0), 1);
    const qualityScore = quality === 'excellent' ? 1 : quality === 'good' ? 0.7 : quality === 'fair' ? 0.4 : 0.1;
    
    const combinedScore = (pitchScore + volumeScore + qualityScore) / 3;
    
    if (combinedScore > 0.8) return 'excited';
    if (combinedScore > 0.6) return 'happy';
    if (combinedScore > 0.4) return 'neutral';
    if (combinedScore > 0.2) return 'concerned';
    return 'stressed';
  };

  const calculateStress = (pitch: number, volume: number): number => {
    const pitchVariation = Math.abs(pitch - 150) / 150;
    const volumeVariation = Math.abs(volume - 50) / 50;
    return Math.min((pitchVariation + volumeVariation) * 50, 100);
  };

  const calculateConfidence = (quality: string, volume: number): number => {
    const qualityScore = quality === 'excellent' ? 1 : quality === 'good' ? 0.8 : quality === 'fair' ? 0.6 : 0.3;
    const volumeScore = Math.min(Math.max(volume / 100, 0), 1);
    return (qualityScore + volumeScore) * 50;
  };

  const calculateSpeakingRate = (stats: any): number => {
    if (!stats || !stats.totalChunks) return 0;
    const avgChunkDuration = stats.totalDuration / stats.totalChunks;
    return Math.min(Math.max(60 / avgChunkDuration, 0), 200); // Words per minute
  };

  const calculateAuthenticity = (pitch: number, volume: number, quality: string): number => {
    const pitchStability = 1 - Math.abs(pitch - 150) / 150;
    const volumeStability = 1 - Math.abs(volume - 50) / 50;
    const qualityScore = quality === 'excellent' ? 1 : quality === 'good' ? 0.8 : quality === 'fair' ? 0.6 : 0.3;
    return (pitchStability + volumeStability + qualityScore) * 33.33;
  };

  const calculateSpoofingRisk = (pitch: number, volume: number, quality: string): number => {
    const pitchAnomaly = Math.abs(pitch - 150) / 150;
    const volumeAnomaly = Math.abs(volume - 50) / 50;
    const qualityPenalty = quality === 'poor' ? 0.3 : 0;
    return Math.min((pitchAnomaly + volumeAnomaly + qualityPenalty) * 50, 100);
  };

  const calculateCognitiveLoad = (pitch: number, volume: number, speakingRate: number): number => {
    const pitchVariation = Math.abs(pitch - 150) / 150;
    const volumeVariation = Math.abs(volume - 50) / 50;
    const rateVariation = Math.abs(speakingRate - 150) / 150;
    return Math.min((pitchVariation + volumeVariation + rateVariation) * 33.33, 100);
  };

  const calculateDeceptionIndicators = (pitch: number, volume: number, stress: number): number => {
    const pitchAnomaly = Math.abs(pitch - 150) / 150;
    const volumeAnomaly = Math.abs(volume - 50) / 50;
    const stressFactor = stress / 100;
    return Math.min((pitchAnomaly + volumeAnomaly + stressFactor) * 33.33, 100);
  };

  const calculateQuantumCoherence = (pitch: number, volume: number): number => {
    const pitchCoherence = 1 - Math.abs(pitch - 150) / 150;
    const volumeCoherence = 1 - Math.abs(volume - 50) / 50;
    return (pitchCoherence + volumeCoherence) * 50;
  };

  const calculateBiometricMatch = (pitch: number, volume: number, gender: string): number => {
    const expectedPitch = gender === 'male' ? 120 : gender === 'female' ? 200 : 150;
    const pitchMatch = 1 - Math.abs(pitch - expectedPitch) / expectedPitch;
    const volumeMatch = 1 - Math.abs(volume - 50) / 50;
    return (pitchMatch + volumeMatch) * 50;
  };

  const calculatePersonalityOpenness = (pitch: number, volume: number, speakingRate: number): number => {
    const pitchVariation = Math.abs(pitch - 150) / 150;
    const volumeVariation = Math.abs(volume - 50) / 50;
    const rateVariation = Math.abs(speakingRate - 150) / 150;
    return Math.min((pitchVariation + volumeVariation + rateVariation) * 33.33, 100);
  };

  const calculateHealthVitality = (pitch: number, volume: number, quality: string): number => {
    const pitchVitality = Math.min(Math.max(pitch / 200, 0), 1);
    const volumeVitality = Math.min(Math.max(volume / 100, 0), 1);
    const qualityScore = quality === 'excellent' ? 1 : quality === 'good' ? 0.8 : quality === 'fair' ? 0.6 : 0.3;
    return (pitchVitality + volumeVitality + qualityScore) * 33.33;
  };

  // This component renders nothing but keeps all analytics running
  return null;
}

// Export the metrics for potential use by other components
export type BackgroundVoiceMetrics = BackgroundMetrics;
