import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RealTimeTranscription } from '@/utils/RealTimeTranscription';
import { VoiceAnalyzer } from '@/utils/VoiceAnalyzer';
import { MedicalAutoCorrector } from '@/utils/MedicalAutoCorrector';

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
  const voiceAnalyzerRef = useRef<VoiceAnalyzer | null>(null);
  const currentVoiceGenderRef = useRef<'male' | 'female' | 'unknown'>('unknown');
  const voiceAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentVoiceCharacteristicsRef = useRef<any>(null);
  const autoCorrectorRef = useRef<MedicalAutoCorrector>(new MedicalAutoCorrector());

  // Initialize transcription engine
  useEffect(() => {
    console.log('🎙️ Initializing real-time transcription engine...');
    
    transcriptionRef.current = new RealTimeTranscription({
      continuous,
      interimResults: true,
      lang: 'en-IN', // Indian English for optimized accuracy
      onResult: async (transcript, isFinal) => {
        console.log('📝 Transcription result:', { 
          text: transcript.substring(0, 50) + '...', 
          isFinal,
          length: transcript.length 
        });
        
        if (isFinal) {
          console.log('✅ Final transcript chunk received');
          
          // Apply medical auto-correction before sending to callback
          const correctedTranscript = autoCorrectorRef.current.correctTranscript(
            transcript, 
            currentVoiceGenderRef.current === 'unknown' ? 'provider' : 
            currentVoiceGenderRef.current === 'female' ? 'patient' : 'provider'
          );
          
          if (onFinalTranscriptChunk) {
            onFinalTranscriptChunk(correctedTranscript);
          }
          setState(prev => ({ ...prev, interimTranscript: '' }));
          
          if (onTranscriptUpdate) {
            onTranscriptUpdate(correctedTranscript, true);
          }
        } else {
          console.log('⏳ Interim transcript update');
          setState(prev => ({ ...prev, interimTranscript: transcript }));
          
          if (onTranscriptUpdate) {
            onTranscriptUpdate(transcript, false);
          }
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
      console.log('🧹 Cleaning up audio recorder on unmount...');
      
      // Stop timers
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop voice analyzer
      if (voiceAnalyzerRef.current) {
        voiceAnalyzerRef.current.cleanup();
        voiceAnalyzerRef.current = null;
      }
      if (voiceAnalysisIntervalRef.current) {
        clearInterval(voiceAnalysisIntervalRef.current);
        voiceAnalysisIntervalRef.current = null;
      }
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // CRITICAL: Stop all media stream tracks
      if (streamRef.current) {
        console.log('🔇 Stopping all media tracks on unmount...');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`🔇 Track ${track.kind} stopped on unmount`);
        });
        streamRef.current = null;
      }
      
      // Close AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('🧹 Closing AudioContext on unmount...');
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop audio monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Stop transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.destroy();
      }
      
      console.log('✅ Audio recorder cleanup complete');
    };
  }, [continuous, onFinalTranscriptChunk, onTranscriptUpdate]);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting audio recording...');
      setState(prev => ({ ...prev, error: null, recordedBlob: null, recordedUrl: null }));
      
      // FORCE CLEANUP: Stop any existing streams first
      if (streamRef.current) {
        console.log('🧹 Force cleanup: Stopping existing stream...');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`🔇 Force stopped track: ${track.kind}, state: ${track.readyState}`);
        });
        streamRef.current = null;
      }
      
      // Close existing AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('🧹 Force cleanup: Closing existing AudioContext...');
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Clean up voice analyzer
      if (voiceAnalyzerRef.current) {
        console.log('🧹 Force cleanup: Cleaning voice analyzer...');
        voiceAnalyzerRef.current.cleanup();
        voiceAnalyzerRef.current = null;
      }
      
      // Clear intervals
      if (voiceAnalysisIntervalRef.current) {
        clearInterval(voiceAnalysisIntervalRef.current);
        voiceAnalysisIntervalRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      console.log('✅ Force cleanup complete, requesting fresh microphone access...');
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true }, // Enhanced for Indian environments
          autoGainControl: { ideal: true },
          sampleRate: sampleRate,
          channelCount: 1,
          ...(deviceId && { deviceId: { exact: deviceId } })
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      console.log('✅ Microphone access granted');
      console.log('🎤 Stream details:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        }))
      });
      
      // Setup single shared audio context for both level monitoring and voice analysis
      audioContextRef.current = new AudioContext();
      const sharedContext = audioContextRef.current;
      
      analyserRef.current = sharedContext.createAnalyser();
      const source = sharedContext.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 4096; // Larger size for pitch detection (was 256)
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      console.log('🎤 Shared AudioContext created:', {
        state: sharedContext.state,
        sampleRate: sharedContext.sampleRate,
        fftSize: analyserRef.current.fftSize
      });
      
      // Initialize advanced voice analyzer WITH the shared context
      try {
        console.log('🎤 Initializing advanced voice analyzer with shared AudioContext...');
        console.log('🎤 Audio stream details:', {
          tracks: stream.getTracks().length,
          active: stream.active,
          audioTracks: stream.getAudioTracks().map(t => ({ 
            id: t.id, 
            enabled: t.enabled, 
            muted: t.muted,
            readyState: t.readyState 
          }))
        });
        
        voiceAnalyzerRef.current = new VoiceAnalyzer();
        console.log('🎤 VoiceAnalyzer instance created, calling initializeWithContext...');
        
        // Pass the shared AudioContext and analyser to VoiceAnalyzer
        const characteristics = await voiceAnalyzerRef.current.initializeWithContext(sharedContext, analyserRef.current);
        console.log('✅ VoiceAnalyzer.initializeWithContext() completed');
        
        currentVoiceCharacteristicsRef.current = characteristics;
        console.log('🎤 Initial characteristics:', {
          gender: characteristics.gender,
          pitch: characteristics.pitch.toFixed(0),
          confidence: (characteristics.confidence * 100).toFixed(0) + '%',
          speakerId: characteristics.speakerId,
          voiceQuality: characteristics.voiceQuality
        });
        
        if (characteristics.gender !== 'unknown') {
          currentVoiceGenderRef.current = characteristics.gender;
          console.log(`🎭 Voice detected: ${characteristics.gender} (${characteristics.pitch.toFixed(0)}Hz, confidence: ${(characteristics.confidence * 100).toFixed(0)}%)`);
        }
        
        // Start real-time voice analysis (every 300ms for more responsive updates)
        console.log('🔄 Starting voice analysis interval (every 300ms)');
        let intervalCount = 0;
        voiceAnalysisIntervalRef.current = setInterval(async () => {
          intervalCount++;
          if (intervalCount % 10 === 0) {
            console.log(`🔄 Voice analysis running (${intervalCount} iterations)`);
          }
          
          if (voiceAnalyzerRef.current) {
            try {
              const updated = await voiceAnalyzerRef.current.analyzeVoiceSample();
              currentVoiceCharacteristicsRef.current = updated;
              
              // Update gender with higher confidence threshold for accuracy
              if (updated.gender !== 'unknown' && updated.confidence > 0.75) {
                const previousGender = currentVoiceGenderRef.current;
                currentVoiceGenderRef.current = updated.gender;
                if (previousGender !== updated.gender) {
                  console.log(`🎭 Voice update: ${updated.gender} (${updated.pitch.toFixed(0)}Hz, ${updated.speakerId})`);
                }
              }
              
              // Log speaker changes
              if (updated.speakerId !== 'silence' && updated.confidence > 0.7) {
                if (intervalCount % 5 === 0) { // Log every 1.5 seconds
                  console.log(`👤 Active speaker: ${updated.speakerId} (pitch: ${updated.pitch.toFixed(0)}Hz, confidence: ${(updated.confidence * 100).toFixed(0)}%)`);
                }
              }
            } catch (error) {
              console.error('❌ Voice analysis error in interval:', error);
            }
          } else {
            console.warn('⚠️ voiceAnalyzerRef.current is null in interval');
          }
        }, 300); // 300ms for more responsive updates
        
        // Log speaker statistics every 5 seconds
        const statsInterval = setInterval(() => {
          if (voiceAnalyzerRef.current) {
            const stats = voiceAnalyzerRef.current.getSpeakerStatistics();
            if (Object.keys(stats).length > 0) {
              console.log('📊 Speaker statistics:', stats);
            }
          }
        }, 5000);
        
        // Store cleanup function
        const originalInterval = voiceAnalysisIntervalRef.current;
        voiceAnalysisIntervalRef.current = setInterval(() => {
          clearInterval(statsInterval);
        }, 0) as any;
        
        console.log('✅ Advanced voice analyzer active - interval ID:', voiceAnalysisIntervalRef.current);
      } catch (error) {
        console.error('❌ Voice analyzer initialization failed:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
    
    // Immediately update UI state first
    setState(prev => ({ 
      ...prev, 
      isPaused: true, 
      isRecording: true,
      isTranscribing: false 
    }));
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      
      // Pause transcription
      if (transcriptionRef.current) {
        console.log('⏸️ Pausing transcription engine');
        transcriptionRef.current.pause();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('✅ Recording paused, isPaused=true');
      toast.info('Recording paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    console.log('▶️ Resume recording called, current state:', mediaRecorderRef.current?.state);
    
    // Immediately update UI state first
    setState(prev => ({ 
      ...prev, 
      isPaused: false, 
      isRecording: true,
      isTranscribing: true 
    }));
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      
      // Resume transcription
      if (transcriptionRef.current) {
        console.log('▶️ Resuming transcription engine');
        transcriptionRef.current.resume();
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      console.log('✅ Recording resumed, isPaused=false');
      toast.success('Recording resumed');
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log('⏹️ Stop recording called, current state:', mediaRecorderRef.current?.state);
    
    // Immediately update state to stop recording
    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      isPaused: false,
      isTranscribing: false,
    }));
    
    if (mediaRecorderRef.current) {
      const currentState = mediaRecorderRef.current.state;
      console.log(`🎙️ MediaRecorder state: ${currentState}`);
      
      // Handle both recording and paused states
      if (currentState === 'paused') {
        console.log('⏹️ Stopping from paused state - resuming first then stopping');
        // Need to resume before stopping if paused
        mediaRecorderRef.current.resume();
        // Small delay to ensure resume is processed
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 10);
      } else if (currentState === 'recording') {
        console.log('⏹️ Stopping from recording state');
        mediaRecorderRef.current.stop();
      }
      
      // Stop voice analyzer
      if (voiceAnalyzerRef.current) {
        console.log('🧹 Cleaning up voice analyzer...');
        const stats = voiceAnalyzerRef.current.getSpeakerStatistics();
        console.log('📊 Final voice statistics:', stats);
        
        voiceAnalyzerRef.current.cleanup();
        voiceAnalyzerRef.current = null;
      }
      
      if (voiceAnalysisIntervalRef.current) {
        clearInterval(voiceAnalysisIntervalRef.current);
        voiceAnalysisIntervalRef.current = null;
      }
      
      // CRITICAL: Stop all media stream tracks to release microphone
      if (streamRef.current) {
        console.log('🔇 Stopping all media tracks to release microphone...');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`🔇 Track ${track.kind} stopped (enabled: ${track.enabled}, readyState: ${track.readyState})`);
        });
        streamRef.current = null;
      }
      
      // Close audio context to release resources
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('🧹 Closing AudioContext...');
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop audio monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      analyserRef.current = null;
      
      // Stop transcription
      if (transcriptionRef.current) {
        console.log('⏹️ Stopping transcription engine');
        transcriptionRef.current.stop();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('✅ Recording stopped successfully, all resources released');
      toast.success('Recording stopped');
    }
  }, []);


  const clearRecording = useCallback(() => {
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
    }
    
    // Clean up voice analyzer if still active
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
    currentVoiceGender: currentVoiceGenderRef.current,
    currentVoiceCharacteristics: currentVoiceCharacteristicsRef.current,
    voiceAnalyzer: voiceAnalyzerRef.current,
    autoCorrector: autoCorrectorRef.current,
  };
}
