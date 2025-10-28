import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RealTimeTranscription } from '@/utils/RealTimeTranscription';
import { ExtremelyAdvancedVoiceAnalyzer } from '@/utils/ExtremelyAdvancedVoiceAnalyzer';
import { MedicalAutoCorrector } from '@/utils/MedicalAutoCorrector';
import { ExtremelyAdvancedMedicalAutoCorrector } from '@/utils/ExtremelyAdvancedMedicalAutoCorrector';

interface AudioRecordingOptions {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  sampleRate?: number;
  deviceId?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  interimTranscript: string;
  transcriptSupported: boolean;
  error: string | null;
  audioLevel: number;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
}

export function useAudioRecording(options: AudioRecordingOptions = {}) {
  const {
    onTranscriptUpdate,
    onFinalTranscriptChunk,
    onRecordingComplete,
    onError,
    continuous = true,
    sampleRate = 48000,
    deviceId,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    isTranscribing: false,
    interimTranscript: '',
    transcriptSupported: true,
    error: null,
    audioLevel: 0,
    recordedBlob: null,
    recordedUrl: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<RealTimeTranscription | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const voiceAnalyzerRef = useRef<ExtremelyAdvancedVoiceAnalyzer | null>(null);
  const currentVoiceGenderRef = useRef<'male' | 'female' | 'non-binary' | 'unknown'>('unknown');
  const voiceAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentVoiceCharacteristicsRef = useRef<any>(null);
  const autoCorrectorRef = useRef<MedicalAutoCorrector>(new MedicalAutoCorrector());
  const extremelyAdvancedAutoCorrectorRef = useRef<ExtremelyAdvancedMedicalAutoCorrector>(
    new ExtremelyAdvancedMedicalAutoCorrector({
      enableAI: true,
      enableML: true,
      enableQuantum: true,
      enableLearning: true,
      enablePrediction: true,
      enableMultiModal: true,
      confidenceThreshold: 0.8,
      learningRate: 0.01,
      quantumBits: 16
    })
  );

  // Initialize transcription engine
  useEffect(() => {
    console.log('🎙️ Initializing real-time transcription engine...');
    
    transcriptionRef.current = new RealTimeTranscription({
      continuous,
      interimResults: true,
      lang: 'en-US',
      onResult: async (transcript, isFinal) => {
        console.log('📝 Transcription result:', { 
          text: transcript.substring(0, 50) + '...', 
          isFinal,
          length: transcript.length 
        });
        
        if (isFinal) {
          console.log('✅ Final transcript chunk received');
          if (onFinalTranscriptChunk) {
            onFinalTranscriptChunk(transcript);
          }
          setState(prev => ({ ...prev, interimTranscript: '' }));
        } else {
          console.log('⏳ Interim transcript update');
          setState(prev => ({ ...prev, interimTranscript: transcript }));
        }
        
        // Apply EXTREMELY ADVANCED auto-correction before sending to callback
        const correctedTranscript = await extremelyAdvancedAutoCorrectorRef.current.correctTranscriptExtremely(
          transcript, 
          currentVoiceGenderRef.current === 'unknown' ? 'provider' : 'patient',
          {
            voiceCharacteristics: currentVoiceCharacteristicsRef.current,
            timestamp: Date.now(),
            speaker: currentVoiceGenderRef.current
          }
        );
        
        if (onTranscriptUpdate) {
          onTranscriptUpdate(correctedTranscript, isFinal);
        }
      },
      onError: (error) => {
        console.error('❌ Transcription error:', error);
        setState(prev => ({ ...prev, error }));
        toast.error(error);
      },
      onStart: () => {
        console.log('✅ Transcription started successfully');
        setState(prev => ({ ...prev, isTranscribing: true }));
        toast.success('Real-time transcription active', { duration: 2000 });
      },
      onEnd: () => {
        console.log('🛑 Transcription ended');
        setState(prev => ({ ...prev, isTranscribing: false }));
      },
    });

    const isSupported = transcriptionRef.current.isBrowserSupported();
    setState(prev => ({ ...prev, transcriptSupported: isSupported }));
    
    if (!isSupported) {
      console.warn('⚠️ Real-time transcription not supported in this browser');
    } else {
      console.log('✅ Real-time transcription is supported');
    }

    return () => {
      console.log('🧹 Cleaning up audio recorder...');
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (transcriptionRef.current) {
        transcriptionRef.current.destroy();
      }
    };
  }, [continuous, onFinalTranscriptChunk, onTranscriptUpdate]);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting audio recording...');
      setState(prev => ({ ...prev, error: null, recordedBlob: null, recordedUrl: null }));
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: sampleRate,
          channelCount: 1,
          ...(deviceId && { deviceId: { exact: deviceId } })
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      console.log('✅ Microphone access granted');
      
      // Setup audio level monitoring
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Initialize EXTREMELY ADVANCED voice analyzer
      try {
        console.log('🎤 Initializing EXTREMELY ADVANCED voice analyzer...');
        
        // Initialize voice analyzer with all features
        voiceAnalyzerRef.current = new ExtremelyAdvancedVoiceAnalyzer({
          enableDeepLearning: true,
          enableQuantumAnalysis: true,
          enableBiometricAuth: true,
          enableAntiSpoofing: true,
          enablePersonalityAnalysis: true,
          enableHealthMonitoring: true,
          enableCulturalAnalysis: true,
          enableDeceptionDetection: true,
          enableEmotionalContagion: true,
          enableMicroExpressions: true,
          enableNeuralStyleTransfer: true,
          enableVoiceSynthesis: true,
          enableRealTimeEnhancement: true,
          enablePredictiveAnalytics: true,
          enableQuantumNeuralNetworks: true,
          confidenceThreshold: 0.8,
          emotionThreshold: 0.7,
          stressThreshold: 0.6,
          authenticityThreshold: 0.9,
          spoofingThreshold: 0.3,
        });
        
        const characteristics = await voiceAnalyzerRef.current.initialize(stream);
        currentVoiceCharacteristicsRef.current = characteristics;
        
        if (characteristics.gender !== 'unknown') {
          currentVoiceGenderRef.current = characteristics.gender;
          console.log(`🎭 EXTREME Voice detected: ${characteristics.gender} (${characteristics.pitch.toFixed(0)}Hz, confidence: ${(characteristics.confidence * 100).toFixed(0)}%)`);
          
          if (characteristics.emotion) {
            console.log(`😊 EXTREME Emotion: ${characteristics.emotion.primary} (${(characteristics.emotion.confidence * 100).toFixed(0)}% confidence)`);
            console.log(`🎯 Emotional Dimensions: Valence=${characteristics.emotion.valence.toFixed(2)}, Arousal=${characteristics.emotion.arousal.toFixed(2)}, Dominance=${characteristics.emotion.dominance.toFixed(2)}`);
          }
          
          if (characteristics.stressLevel) {
            console.log(`😰 EXTREME Stress level: ${(characteristics.stressLevel * 100).toFixed(0)}%`);
          }
          
          console.log(`🛡️ Authenticity Score: ${(characteristics.authenticityScore * 100).toFixed(0)}%`);
          console.log(`⚠️ Spoofing Risk: ${(characteristics.spoofingRisk * 100).toFixed(0)}%`);
          console.log(`🧠 Cognitive Load: ${(characteristics.cognitiveLoad * 100).toFixed(0)}%`);
          console.log(`🎭 Deception Indicators: ${(characteristics.deceptionIndicators * 100).toFixed(0)}%`);
        }
        
        // Start EXTREMELY ADVANCED real-time analysis
        const stopAnalysis = voiceAnalyzerRef.current.startExtremelyAdvancedAnalysis((updatedCharacteristics) => {
          currentVoiceCharacteristicsRef.current = updatedCharacteristics;
          
          if (updatedCharacteristics.gender !== 'unknown' && updatedCharacteristics.confidence > 0.6) {
            currentVoiceGenderRef.current = updatedCharacteristics.gender;
          }
        });
        
        // Store cleanup function
        voiceAnalysisIntervalRef.current = setInterval(() => {
          if (voiceAnalyzerRef.current) {
            const stats = voiceAnalyzerRef.current.getExtremelyAdvancedStatistics();
            if (stats.speakers && Object.keys(stats.speakers).length > 0) {
              console.log('📊 EXTREMELY ADVANCED speaker statistics:', stats);
              console.log('🧠 ML Status:', stats.mlStatus);
              console.log('🎯 Biometric Accuracy:', stats.biometricAccuracy);
              console.log('😊 Emotion Accuracy:', stats.emotionAccuracy);
              console.log('🛡️ Spoofing Detection:', stats.spoofingDetection);
              console.log('🧠 Personality Accuracy:', stats.personalityAccuracy);
              console.log('❤️ Health Monitoring:', stats.healthMonitoring);
            }
          }
        }, 5000); // Log stats every 5 seconds
        
        console.log('✅ EXTREMELY ADVANCED voice analyzer active with ALL FEATURES');
        console.log('🚀 Neural Networks: ACTIVE');
        console.log('🌌 Quantum Processing: ACTIVE');
        console.log('🛡️ Anti-Spoofing: ACTIVE');
        console.log('🧠 Personality Analysis: ACTIVE');
        console.log('❤️ Health Monitoring: ACTIVE');
        console.log('🎭 Deception Detection: ACTIVE');
        console.log('🌍 Cultural Analysis: ACTIVE');
        console.log('🔬 Biometric Authentication: ACTIVE');
      } catch (error) {
        console.warn('⚠️ EXTREMELY ADVANCED voice analyzer initialization failed:', error);
        // Continue without voice analysis
      }
      
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = Math.min(100, (average / 255) * 100);
        
        setState(prev => ({ ...prev, audioLevel: normalized }));
        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };
      
      monitorAudioLevel();
      
      // Try different MIME types for better compatibility
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('✅ Using MIME type:', type);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
          console.log(`📦 Audio chunk received: ${event.data.size} bytes (Total: ${(totalSize / 1024).toFixed(2)} KB)`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        
        console.log(`✅ Audio blob created: ${audioBlob.size} bytes (${mimeType})`);
        
        setState(prev => ({ 
          ...prev, 
          recordedBlob: audioBlob,
          recordedUrl: url,
          audioLevel: 0
        }));
        
        // Stop audio monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Audio track stopped');
        });
        
        // Stop transcription
        if (transcriptionRef.current) {
          const finalTranscript = transcriptionRef.current.stop();
          console.log('📝 Final transcript:', finalTranscript);
        }
        
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, url);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
      
      console.log('🎙️ MediaRecorder started');
      
      // Start transcription
      if (transcriptionRef.current && transcriptionRef.current.isBrowserSupported()) {
        console.log('🚀 Starting real-time transcription...');
        const started = transcriptionRef.current.start();
        if (started) {
          setState(prev => ({ ...prev, isTranscribing: true }));
          console.log('✅ Real-time transcription started successfully');
        } else {
          console.warn('⚠️ Transcription failed to start');
          toast.warning('Real-time transcription not available. You can still record and transcribe later.');
        }
      } else {
        console.warn('⚠️ Transcription not supported');
        toast.warning('Real-time transcription not supported in this browser. Using Chrome is recommended.');
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('❌ Microphone access error:', error);
      const errorMessage = 'Failed to access microphone. Please grant permission.';
      setState(prev => ({ ...prev, error: errorMessage, audioLevel: 0 }));
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    }
  }, [state.transcriptSupported, onRecordingComplete, onError, sampleRate, deviceId]);

  const pauseRecording = useCallback(() => {
    console.log('⏸️ Pause recording called, current state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true, isTranscribing: false }));
      
      // Pause transcription
      if (transcriptionRef.current) {
        console.log('⏸️ Pausing transcription engine');
        transcriptionRef.current.pause();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      toast.info('Recording paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    console.log('▶️ Resume recording called, current state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false, isTranscribing: true }));
      
      // Resume transcription
      if (transcriptionRef.current) {
        console.log('▶️ Resuming transcription engine');
        transcriptionRef.current.resume();
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      toast.success('Recording resumed');
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log('⏹️ Stop recording called, current state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isPaused: false,
        isTranscribing: false,
        duration: 0 
      }));
      
      // Stop EXTREMELY ADVANCED voice analyzer
      if (voiceAnalyzerRef.current) {
        console.log('🧹 Cleaning up EXTREMELY ADVANCED voice analyzer...');
        const stats = voiceAnalyzerRef.current.getExtremelyAdvancedStatistics();
        console.log('📊 Final EXTREMELY ADVANCED statistics:', stats);
        
        voiceAnalyzerRef.current.cleanup();
        voiceAnalyzerRef.current = null;
      }
      
      if (voiceAnalysisIntervalRef.current) {
        clearInterval(voiceAnalysisIntervalRef.current);
        voiceAnalysisIntervalRef.current = null;
      }
      
      // Stop transcription
      if (transcriptionRef.current) {
        console.log('⏹️ Stopping transcription engine');
        transcriptionRef.current.stop();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success('Recording stopped');
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
    }
    
    // Clean up EXTREMELY ADVANCED voice analyzer if still active
    if (voiceAnalyzerRef.current) {
      voiceAnalyzerRef.current.cleanup();
      voiceAnalyzerRef.current = null;
    }
    
    currentVoiceGenderRef.current = 'unknown';
    currentVoiceCharacteristicsRef.current = null;
    
    setState(prev => ({
      ...prev,
      recordedBlob: null,
      recordedUrl: null,
      interimTranscript: '',
      duration: 0,
    }));
    chunksRef.current = [];
  }, [state.recordedUrl]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearRecording,
    formatDuration,
    currentVoiceGender: currentVoiceGenderRef.current, // Expose current voice gender
    currentVoiceCharacteristics: currentVoiceCharacteristicsRef.current, // Expose full characteristics
    voiceAnalyzer: voiceAnalyzerRef.current, // Expose voice analyzer instance
    extremelyAdvancedAutoCorrector: extremelyAdvancedAutoCorrectorRef.current, // Expose EXTREME auto-corrector
  };
}
