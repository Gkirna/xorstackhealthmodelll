/**
 * Hook to access background voice analytics data
 * Allows other components to read analytics without displaying the UI
 */

import { useState, useEffect } from 'react';

interface BackgroundAnalyticsData {
  timestamp: number;
  metrics: {
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
  };
  speakerStats: any;
  emotionDistribution: any;
}

export function useBackgroundVoiceAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<BackgroundAnalyticsData | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkAnalytics = () => {
      try {
        const stored = sessionStorage.getItem('backgroundVoiceAnalytics');
        if (stored) {
          const data = JSON.parse(stored) as BackgroundAnalyticsData;
          const isRecent = Date.now() - data.timestamp < 5000; // Data is fresh if less than 5 seconds old
          
          setAnalyticsData(data);
          setIsActive(isRecent);
        } else {
          setIsActive(false);
        }
      } catch (error) {
        console.error('Error reading background analytics:', error);
        setIsActive(false);
      }
    };

    // Check immediately
    checkAnalytics();

    // Check every 2 seconds
    const interval = setInterval(checkAnalytics, 2000);

    return () => clearInterval(interval);
  }, []);

  return {
    analyticsData,
    isActive,
    // Helper functions
    getCurrentEmotion: () => analyticsData?.metrics.currentEmotion || 'neutral',
    getCurrentStress: () => analyticsData?.metrics.currentStress || 0,
    getCurrentSpeaker: () => analyticsData?.metrics.currentSpeaker || 'unknown',
    getVoiceQuality: () => analyticsData?.metrics.voiceQuality || 'poor',
    getConfidence: () => analyticsData?.metrics.confidence || 0,
    getAuthenticityScore: () => analyticsData?.metrics.authenticityScore || 0,
    getSpoofingRisk: () => analyticsData?.metrics.spoofingRisk || 0,
    getCognitiveLoad: () => analyticsData?.metrics.cognitiveLoad || 0,
    getHealthVitality: () => analyticsData?.metrics.healthVitality || 0,
  };
}
