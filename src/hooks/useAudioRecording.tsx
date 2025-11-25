import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { WhisperTranscription } from '@/utils/WhisperTranscription';
import { VoiceAnalyzer } from '@/utils/VoiceAnalyzer';
import { MedicalAutoCorrector } from '@/utils/MedicalAutoCorrector';

// Global singleton to track active audio recording
let globalActiveStream: MediaStream | null = null;
let globalActiveContext: AudioContext | null = null;

interface AudioRecordingOptions {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  sampleRate?: number;
  deviceId?: string;
  language?: string; // Language code for transcription (e.g., 'kn-IN', 'en-IN')
  mode?: 'direct' | 'playback'; // Recording mode: direct conversation or playback transcription
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
  voiceQuality: 'excellent' | 'good' | 'fair' | 'poor';
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
    language = 'en-US', // Default to English (US) for multi-accent support
    mode = 'direct', // Default to direct recording
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
    voiceQuality: 'fair',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<WhisperTranscription | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const voiceAnalyzerRef = useRef<VoiceAnalyzer | null>(null);
  const currentVoiceGenderRef = useRef<'male' | 'female' | 'unknown'>('unknown');
  const voiceAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentVoiceCharacteristicsRef = useRef<any>(null);
  const autoCorrectorRef = useRef<MedicalAutoCorrector>(new MedicalAutoCorrector());

  // Initialize transcription engine ONCE with stable config
  const transcriptionInitialized = useRef(false);
  
  useEffect(() => {
    // Prevent multiple initializations
    if (transcriptionInitialized.current) {
      console.log('⚠️ Transcription already initialized, skipping');
      return;
    }
    
    console.log(`🎙️ Initializing Whisper transcription engine for language: ${language}, mode: ${mode}`);
    transcriptionInitialized.current = true;
    
    transcriptionRef.current = new WhisperTranscription({
      language: language.split('-')[0], // Extract base language code (e.g., 'en' from 'en-US')
      mode,
      onResult: async (transcript, isFinal) => {
        console.log('📝 Whisper transcription result:', { 
          text: transcript.substring(0, 50) + '...', 
          isFinal,
          length: transcript.length 
        });
        
        if (isFinal) {
          console.log('✅ Final transcript chunk received from Whisper');
          
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
        console.error('❌ Whisper transcription error:', error);
        setState(prev => ({ ...prev, error }));
        if (error.includes('OPENAI_API_KEY')) {
          toast.error('OpenAI API key not configured. Please contact support.');
        } else {
          toast.error(error);
        }
      },
      onStart: () => {
        console.log('✅ Whisper transcription started successfully');
        setState(prev => ({ ...prev, isTranscribing: true }));
        toast.success('Advanced AI transcription active', { duration: 2000 });
      },
      onEnd: () => {
        console.log('🛑 Whisper transcription ended');
        setState(prev => ({ ...prev, isTranscribing: false }));
      },
    });

    // Whisper is always supported (uses API)
    setState(prev => ({ ...prev, transcriptSupported: true }));
    console.log('✅ Whisper transcription is ready');

    return () => {
      console.log('🧹 Cleaning up audio recorder...');
      transcriptionInitialized.current = false;
      
      // Stop timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
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
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('MediaRecorder already stopped');
        }
      }
      
      // CRITICAL: Stop all media stream tracks
      if (streamRef.current) {
        console.log('🔇 Stopping all media tracks...');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Update global refs
      if (globalActiveStream === streamRef.current) {
        globalActiveStream = null;
      }
      
      // Close AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (globalActiveContext === audioContextRef.current) {
        globalActiveContext = null;
      }
      
      // Stop audio monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Stop transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.destroy();
        transcriptionRef.current = null;
      }
      
      console.log('✅ Audio recorder cleanup complete');
    };
  }, []); // Empty deps - initialize once, cleanup on unmount

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting audio recording...');
      setState(prev => ({ ...prev, error: null, recordedBlob: null, recordedUrl: null }));
      
      // Local cleanup before starting
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        globalActiveStream = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
        globalActiveContext = null;
      }
      
      if (voiceAnalyzerRef.current) {
        voiceAnalyzerRef.current.cleanup();
        voiceAnalyzerRef.current = null;
      }
      
      if (voiceAnalysisIntervalRef.current) {
        clearInterval(voiceAnalysisIntervalRef.current);
        voiceAnalysisIntervalRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      analyserRef.current = null;
      
      console.log('✅ All cleanup complete, requesting microphone...');
      console.log(`🎤 Recording mode: ${mode}`);
      
      // Enhanced audio constraints for playback mode
      const constraints: MediaStreamConstraints = {
        audio: mode === 'playback' ? {
          echoCancellation: true, // Aggressive echo cancellation
          noiseSuppression: true, // Strong noise suppression
          autoGainControl: true, // Adaptive gain control
          sampleRate: sampleRate,
          channelCount: 1,
          ...(deviceId && { deviceId: { exact: deviceId } }),
          // Additional constraints for playback mode
          advanced: [
            { echoCancellation: { exact: true } },
            { noiseSuppression: { exact: true } },
            { autoGainControl: { exact: true } }
          ]
        } : {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: sampleRate,
          channelCount: 1,
          ...(deviceId && { deviceId: { exact: deviceId } })
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Store in both local and global refs
      streamRef.current = stream;
      globalActiveStream = stream;
      
      console.log('✅ Microphone access granted');
      console.log('🎤 Stream:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length
      });
      
      // CRITICAL: Create and start MediaRecorder FIRST before AudioContext
      // (AudioContext can consume the stream and prevent MediaRecorder from starting)
      console.log('🎬 Creating MediaRecorder FIRST (before AudioContext)...');
      let mediaRecorder: MediaRecorder;
      let mimeType = 'audio/webm';
      
      try {
        // Try explicit format with timeslice for better audio capture
        const supportedTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4'
        ];
        
        let created = false;
        for (const type of supportedTypes) {
          try {
            if (MediaRecorder.isTypeSupported(type)) {
              mediaRecorder = new MediaRecorder(stream, { 
                mimeType: type,
                audioBitsPerSecond: 128000 // 128kbps for better quality
              });
              mimeType = type;
              console.log('✅ MediaRecorder created with:', type);
              created = true;
              break;
            }
          } catch (e) {
            console.warn(`⚠️ Failed to create MediaRecorder with ${type}:`, e);
            continue;
          }
        }
        
        if (!created) {
          // Fallback to browser default
          mediaRecorder = new MediaRecorder(stream);
          mimeType = mediaRecorder.mimeType || 'audio/webm';
          console.log('✅ MediaRecorder created with browser default:', mimeType);
        }
      } catch (error) {
        console.error('❌ Failed to create MediaRecorder:', error);
        throw new Error('Failed to create MediaRecorder with any configuration');
      }
      
      console.log('📝 MediaRecorder final MIME type:', mimeType);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log(`📦 ondataavailable fired - data size: ${event.data.size} bytes`);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
          console.log(`📦 Audio chunk: ${event.data.size} bytes (Total: ${(totalSize / 1024).toFixed(2)} KB, Chunks: ${chunksRef.current.length})`);
        } else {
          console.warn('⚠️ Audio chunk is empty (0 bytes)');
        }
      };
      
      mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event.error);
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        
        console.log(`✅ Audio blob: ${audioBlob.size} bytes (${mimeType})`);
        
        setState(prev => ({ 
          ...prev, 
          recordedBlob: audioBlob,
          recordedUrl: url,
          audioLevel: 0
        }));
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try {
            await audioContextRef.current.close();
            console.log('🔇 AudioContext closed in onstop');
          } catch (e) {
            console.warn('⚠️ AudioContext already closed:', e);
          }
        }
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Track stopped');
        });
        
        if (transcriptionRef.current) {
          const finalTranscript = transcriptionRef.current.stop();
          console.log('📝 Final transcript:', finalTranscript);
        }
        
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, url);
        }
      };

      // Start MediaRecorder BEFORE AudioContext processes the stream
      try {
        // Start with smaller timeslice for better audio capture
        mediaRecorder.start(100); // Request data every 100ms
        console.log('🎬 MediaRecorder.start() called with 100ms timeslice');
        console.log('🎬 MediaRecorder state:', mediaRecorder.state);
        console.log('✅ MediaRecorder started successfully');
      } catch (startError) {
        console.error('❌ MediaRecorder start failed:', startError);
        throw new Error('Failed to start recording: ' + (startError instanceof Error ? startError.message : String(startError)));
      }
      
      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
      
      // NOW setup AudioContext (after MediaRecorder is running)
      console.log('🎤 Now setting up AudioContext for visualization...');
      audioContextRef.current = new AudioContext();
      globalActiveContext = audioContextRef.current;
      const sharedContext = audioContextRef.current;
      
      analyserRef.current = sharedContext.createAnalyser();
      const source = sharedContext.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 4096;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      console.log('✅ AudioContext setup complete');
      
      // Initialize voice analyzer (non-critical, can fail gracefully)
      try {
        console.log('🎤 Initializing voice analyzer...');
        voiceAnalyzerRef.current = new VoiceAnalyzer(mode);
        const characteristics = await voiceAnalyzerRef.current.initializeWithContext(sharedContext, analyserRef.current);
        console.log('✅ Voice analyzer initialized');
        
        currentVoiceCharacteristicsRef.current = characteristics;
        console.log('🎤 Initial characteristics:', {
          gender: characteristics.gender,
          pitch: characteristics.pitch.toFixed(0),
          confidence: (characteristics.confidence * 100).toFixed(0) + '%',
          speakerId: characteristics.speakerId,
          voiceQuality: characteristics.voiceQuality
        });
        
        // Update state with voice quality
        setState(prev => ({ ...prev, voiceQuality: characteristics.voiceQuality }));
        
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
          // Check if voice analyzer still exists before analyzing
          if (!voiceAnalyzerRef.current) {
            // Voice analyzer may have been cleaned up, skip this iteration
            return;
          }
          
          try {
            const updated = await voiceAnalyzerRef.current.analyzeVoiceSample();
            currentVoiceCharacteristicsRef.current = updated;
            
            // Update state with voice quality
            setState(prev => ({ ...prev, voiceQuality: updated.voiceQuality }));
            
            // Update gender with adjusted confidence threshold based on mode
            const confidenceThreshold = mode === 'playback' ? 0.6 : 0.75;
            if (updated.gender !== 'unknown' && updated.confidence > confidenceThreshold) {
              const previousGender = currentVoiceGenderRef.current;
              currentVoiceGenderRef.current = updated.gender;
              if (previousGender !== updated.gender) {
                console.log(`🎭 Voice update: ${updated.gender} (${updated.pitch.toFixed(0)}Hz, ${updated.speakerId})`);
              }
            }
            
            // Log real-time analysis every 3 seconds (10 intervals)
            if (intervalCount % 10 === 0) {
              console.log(`🎤 Voice Analysis Update #${intervalCount / 10}:`, {
                gender: updated.gender,
                pitch: updated.pitch.toFixed(0) + 'Hz',
                confidence: (updated.confidence * 100).toFixed(0) + '%',
                quality: updated.voiceQuality,
                speakerId: updated.speakerId,
                volume: updated.volume.toFixed(0) + 'dB'
              });
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
        console.error('❌ Voice analyzer failed (non-critical):', error);
        // Continue without voice analysis
      }
      
      // Start Whisper transcription with audio stream
      if (transcriptionRef.current) {
        console.log(`🎙️ Starting Whisper AI transcription for ${mode} mode...`);
        console.log(`🎙️ Language: ${language}`);
        console.log(`🎙️ Mode: ${mode}`);
        
        const started = await transcriptionRef.current.start(stream);
        if (started) {
          setState(prev => ({ ...prev, isTranscribing: true }));
          console.log('✅ Whisper transcription started successfully');
          
          if (mode === 'playback') {
            console.log('🔊 PLAYBACK MODE INSTRUCTIONS:');
            console.log('   1. Play your audio file on external speakers');
            console.log('   2. Make sure microphone can hear the speakers clearly');
            console.log('   3. Adjust volume to medium-high level');
            console.log('   4. Minimize background noise');
            toast.success('Advanced AI transcription active - play audio near your microphone', {
              duration: 5000
            });
          } else {
            toast.success('Advanced AI transcription active');
          }
        } else {
          console.warn('⚠️ Whisper transcription failed to start');
          toast.warning('Transcription failed to start. Please check your settings.');
        }
      }
      
      // Start audio level monitoring
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
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('❌ Recording error:', error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      
      let errorMessage = 'Failed to start recording. Please try again.';
      
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
      } else if (error?.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (error?.name === 'NotReadableError') {
        errorMessage = 'Microphone is in use by another app. Close other apps and try again.';
      } else if (error?.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not meet requirements. Try a different microphone.';
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Recording was aborted. Please try again.';
      } else if (error?.name === 'NotSupportedError') {
        errorMessage = 'Your browser does not support audio recording. Try Chrome or Edge.';
      } else if (error?.message?.includes('MediaRecorder')) {
        errorMessage = 'Failed to initialize recorder. Please refresh the page.';
      }
      
      console.error('❌ Final error message:', errorMessage);
      
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        globalActiveStream = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
        globalActiveContext = null;
      }
      
      setState(prev => ({ ...prev, error: errorMessage, audioLevel: 0, isRecording: false }));
      toast.error(errorMessage, { duration: 5000 });
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
      
      // Pause Whisper transcription
      if (transcriptionRef.current) {
        console.log('⏸️ Pausing Whisper transcription engine');
        transcriptionRef.current.pause();
      }
      
      // KEEP voice analyzer running but log that we're paused
      console.log('⏸️ Voice analyzer continues monitoring during pause for seamless resume');
      
      // KEEP AudioContext and analyser running for instant resume
      console.log('⏸️ AudioContext and analyser remain active for instant resume');
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('✅ Recording paused - voice analysis and audio monitoring continue');
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
      
      // Resume Whisper transcription
      if (transcriptionRef.current) {
        console.log('▶️ Resuming Whisper transcription engine');
        transcriptionRef.current.resume();
      }
      
      // Verify voice analyzer is still running
      if (voiceAnalyzerRef.current) {
        console.log('✅ Voice analyzer still active - seamless resume');
        // Log current voice characteristics
        if (currentVoiceCharacteristicsRef.current) {
          console.log('🎤 Current voice state:', {
            gender: currentVoiceCharacteristicsRef.current.gender,
            pitch: currentVoiceCharacteristicsRef.current.pitch?.toFixed(0) + 'Hz',
            speakerId: currentVoiceCharacteristicsRef.current.speakerId,
            confidence: (currentVoiceCharacteristicsRef.current.confidence * 100).toFixed(0) + '%'
          });
        }
      } else {
        console.warn('⚠️ Voice analyzer lost during pause - this should not happen');
      }
      
      // Verify AudioContext is still active
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('✅ AudioContext still active:', audioContextRef.current.state);
      } else {
        console.error('❌ AudioContext lost during pause - real-time features may be degraded');
      }
      
      // Verify analyser is still connected
      if (analyserRef.current) {
        console.log('✅ Audio analyser still connected');
      } else {
        console.warn('⚠️ Audio analyser disconnected during pause');
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      console.log('✅ Recording resumed with all real-time features active');
      toast.success('Recording resumed - all features active');
    }
  }, []);

  const stopRecording = useCallback(async () => {
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
          console.log(`🔇 Track ${track.kind} stopped`);
        });
        streamRef.current = null;
        globalActiveStream = null;
      }
      
      // Close audio context to release resources
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            console.log('🧹 Closing AudioContext...');
            await audioContextRef.current.close();
            console.log('✅ AudioContext closed successfully');
          }
        } catch (closeError) {
          console.warn('⚠️ AudioContext close error (may already be closed):', closeError);
        } finally {
          audioContextRef.current = null;
          globalActiveContext = null;
        }
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
