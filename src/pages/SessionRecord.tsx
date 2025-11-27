import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioLines, ListPlus, PencilLine } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { useTranscription } from "@/hooks/useTranscription";
import { useHybridTranscription } from "@/hooks/useHybridTranscription";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useTranscriptUpdates, useSessionUpdates } from "@/hooks/useRealtime";
import { WorkflowOrchestrator } from "@/utils/WorkflowOrchestrator";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import type { WorkflowState } from "@/utils/WorkflowOrchestrator";
import { SessionTopBar } from "@/components/session/SessionTopBar";
import { HeidiTranscriptPanel } from "@/components/session/HeidiTranscriptPanel";
import { HeidiContextPanel } from "@/components/session/HeidiContextPanel";
import { HeidiNotePanel } from "@/components/session/HeidiNotePanel";
import { DictatingPanel } from "@/components/session/DictatingPanel";
import { AudioUploadTranscription } from "@/components/AudioUploadTranscription";
import { AskHeidiBar } from "@/components/session/AskHeidiBar";
import { ExtremelyAdvancedVoiceVisualizationDashboard } from '@/components/ExtremelyAdvancedVoiceVisualizationDashboard';
import { ExtremelyAdvancedAutoCorrectorDashboard } from '@/components/ExtremelyAdvancedAutoCorrectorDashboard';
import { AdvancedTranscriptionDashboard } from '@/components/AdvancedTranscriptionDashboard';
import { useAdvancedTranscription } from '@/hooks/useAdvancedTranscription';
import type { EnhancedTranscriptionData } from '@/types/advancedTranscription';
import { TemplateSelectionDialog } from "@/components/session/TemplateSelectionDialog";
import { AudioQualityIndicator } from "@/components/AudioQualityIndicator";

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  
  // ALL STATE HOOKS FIRST
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [template, setTemplate] = useState<string>("");
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isAutoPipelineRunning, setIsAutoPipelineRunning] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [showFormattedNote, setShowFormattedNote] = useState(true);
  const [noteJson, setNoteJson] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [patientName, setPatientName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date());
  const [language, setLanguage] = useState("en");
  const [microphone, setMicrophone] = useState("default");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [recordingMode, setRecordingMode] = useState("transcribing");
  const [activeTab, setActiveTab] = useState<string>("transcript");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploadTranscribing, setIsUploadTranscribing] = useState(false);
  const [uploadTranscriptionTime, setUploadTranscriptionTime] = useState(0);
  const uploadProcessingRef = useRef<boolean>(false);
  const [enhancedTranscriptionData, setEnhancedTranscriptionData] = useState<EnhancedTranscriptionData | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [recordingInputMode, setRecordingInputMode] = useState<'direct' | 'playback'>('direct');
  const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState<string>('whisper-1');
  
  // ALL REFS NEXT
  const orchestratorRef = useRef<WorkflowOrchestrator | null>(null);
  const timerRef = useRef<number | null>(null);
  const uploadTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date>(new Date());
  const speakerRef = useRef<'provider' | 'patient'>('provider');
  const transcriptCountRef = useRef(0);
  const lastTranscriptTimeRef = useRef<number>(0);
  
  // CRITICAL: Create stable session ID once and never change it
  const sessionIdRef = useRef(id);
  useEffect(() => {
    if (id && sessionIdRef.current !== id) {
      sessionIdRef.current = id;
    }
  }, [id]);

  // Language code mapping: simple code -> locale code for transcription
  const getTranscriptionLanguage = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'kn': 'kn-IN', // Kannada
      'hi': 'hi-IN', // Hindi
      'ta': 'ta-IN', // Tamil
      'te': 'te-IN', // Telugu
      'en': 'en-US', // English (US) - supports all English accents
    };
    return languageMap[lang] || 'en-US';
  };

  // CUSTOM HOOKS - Initialize transcription hook FIRST with stable session ID
  const transcriptionSessionId = sessionIdRef.current || 'default';
  // Remove excessive logging that causes performance issues
  
  const { 
    transcriptChunks, 
    addTranscriptChunk, 
    loadTranscripts, 
    getFullTranscript,
    getDiarizedTranscript,
    saveAllPendingChunks, 
    stats, 
    updateVoiceCharacteristics,
    getSpeakerStatistics,
    resetDiarization,
  } = useTranscription(transcriptionSessionId, 'unknown');
  
  // Update transcription model dynamically
  useEffect(() => {
    console.log('🎯 Model changed to:', selectedTranscriptionModel);
  }, [selectedTranscriptionModel]);
  
  // Create stable callback refs that don't cause re-renders
  const handleTranscriptUpdateRef = useRef<(text: string, isFinal: boolean) => void>();
  const handleRecordingErrorRef = useRef<(error: string) => void>();
  
  // Store recording options in refs to prevent recreating callbacks
  const languageRef = useRef(language);
  const recordingInputModeRef = useRef(recordingInputMode);
  
  // Update refs when values change
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  
  useEffect(() => {
    recordingInputModeRef.current = recordingInputMode;
  }, [recordingInputMode]);
  
  // Define the actual callback implementations
  handleTranscriptUpdateRef.current = (text: string, isFinal: boolean) => {
    if (isFinal && text.trim()) {
      const currentTime = Date.now();
      const timeSinceLastTranscript = currentTime - lastTranscriptTimeRef.current;
      
      // Enhanced speaker detection for playback mode (3 second threshold for better accuracy)
      if (recordingInputModeRef.current === 'playback' && timeSinceLastTranscript > 3000) {
        speakerRef.current = speakerRef.current === 'provider' ? 'patient' : 'provider';
        console.log(`🔄 Speaker change detected: ${speakerRef.current} (gap: ${timeSinceLastTranscript}ms)`);
      }
      
      const currentSpeaker = speakerRef.current;
      transcriptCountRef.current++;
      lastTranscriptTimeRef.current = currentTime;
      
      console.log(`💬 Final transcript #${transcriptCountRef.current} [${currentSpeaker}]: "${text.substring(0, 80)}..."`);
      
      // Add to transcription system - it will update transcriptChunks and trigger the useEffect to update UI
      addTranscriptChunk(text, currentSpeaker);
      
      // Alternate speaker for direct mode (conversation flow)
      if (recordingInputModeRef.current === 'direct') {
        speakerRef.current = currentSpeaker === 'provider' ? 'patient' : 'provider';
      }
    } else if (!isFinal && text.trim()) {
      // Show interim results in console for debugging
      console.log(`⏳ Interim: "${text.substring(0, 50)}..."`);
    }
  };
  
  handleRecordingErrorRef.current = (error: string) => {
    console.error('❌ Recording error:', error);
    toast.error(error, { duration: 5000 });
  };
  
  // Create stable options object ONCE with deviceId support
  const audioRecordingOptions = useMemo(() => ({
    continuous: true,
    disableInternalTranscription: true, // Use hybrid transcription instead
    get language() {
      return languageRef.current.split('-')[0] === 'en' ? 'en-US' : 
             languageRef.current.split('-')[0] === 'kn' ? 'kn-IN' :
             languageRef.current.split('-')[0] === 'hi' ? 'hi-IN' :
             languageRef.current.split('-')[0] === 'ta' ? 'ta-IN' :
             languageRef.current.split('-')[0] === 'te' ? 'te-IN' : 'en-US';
    },
    get mode() {
      return recordingInputModeRef.current;
    },
    get deviceId() {
      return microphone !== 'default' ? microphone : undefined;
    },
    model: selectedTranscriptionModel,
    onTranscriptUpdate: (text: string, isFinal: boolean) => {
      handleTranscriptUpdateRef.current?.(text, isFinal);
    },
    onError: (error: string) => {
      handleRecordingErrorRef.current?.(error);
    },
  }), [microphone, selectedTranscriptionModel]); // Add selectedTranscriptionModel as dependency
  
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    isRecording,
    isPaused,
    duration,
    isTranscribing,
    interimTranscript,
    transcriptSupported,
    error: recordingError,
    audioLevel,
    recordedBlob,
    recordedUrl,
    currentVoiceGender,
    currentVoiceCharacteristics,
    voiceAnalyzer,
    autoCorrector,
    formatDuration,
    voiceQuality,
  } = useAudioRecording(audioRecordingOptions);
  
  // Sync voice characteristics to transcription system
  const lastSyncedCharacteristicsRef = useRef<string>('');
  useEffect(() => {
    if (currentVoiceCharacteristics) {
      const characteristicsKey = `${currentVoiceCharacteristics.gender}-${currentVoiceCharacteristics.pitch}-${currentVoiceCharacteristics.confidence}`;
      
      // Only update if characteristics actually changed (prevent unnecessary updates)
      if (characteristicsKey !== lastSyncedCharacteristicsRef.current) {
        console.log('🔄 Syncing voice characteristics:', {
          gender: currentVoiceCharacteristics.gender,
          pitch: currentVoiceCharacteristics.pitch.toFixed(0),
          confidence: (currentVoiceCharacteristics.confidence * 100).toFixed(0) + '%'
        });
        updateVoiceCharacteristics(currentVoiceCharacteristics);
        lastSyncedCharacteristicsRef.current = characteristicsKey;
      }
    }
  }, [currentVoiceCharacteristics, updateVoiceCharacteristics]);
  
  // Advanced transcription
  const { processAudioWithFullAnalysis, isProcessing } = useAdvancedTranscription();
  
  // Hybrid transcription with multiple provider support
  const hybridTranscription = useHybridTranscription({
    sessionId: transcriptionSessionId,
    mode: 'auto',
    model: selectedTranscriptionModel,
    enableAutoCorrection: true,
    onTranscriptUpdate: (text: string, isFinal: boolean) => {
      handleTranscriptUpdateRef.current?.(text, isFinal);
    },
    onFinalTranscriptChunk: (text: string) => {
      // This is called when a final chunk is available from the provider
      handleTranscriptUpdateRef.current?.(text, true);
    },
  });

  // CALLBACKS AFTER HOOKS
  const handleStartTranscribing = useCallback(async () => {
    console.log('🎯 handleStartTranscribing called:', {
      isStartingRecording,
      isRecording,
      recordingMode
    });
    
    if (isStartingRecording) {
      console.log('⏳ Already starting recording, ignoring click');
      return;
    }

    if (isRecording) {
      console.log('🛑 Stopping recording and hybrid transcription...');
      toast.success('Stopping transcription...');
      
      // Stop hybrid transcription first
      hybridTranscription.stop();
      
      await saveAllPendingChunks();
      stopRecording();
      
      // Auto-generate clinical note after stopping
      setTimeout(async () => {
        toast.info('Generating clinical note...');
        await autoGenerateNote();
      }, 1000);
      return;
    }

    if (recordingMode === 'upload') {
      console.log('📁 Upload mode selected - opening upload dialog');
      setUploadDialogOpen(true);
      return;
    }

    if (recordingMode === 'dictating' || recordingMode === 'transcribing') {
      console.log('🎤 Starting recording in mode:', recordingMode);
      setIsStartingRecording(true);
      
      try {
        setActiveTab('transcript');
        speakerRef.current = 'provider';
        transcriptCountRef.current = 0;
        toast.success('Starting live transcription... Speak now!');
        
        console.log('📞 Calling startRecording()...');
        await startRecording();
        
        // Start hybrid transcription with the audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await hybridTranscription.start(stream);
        
        console.log('✅ startRecording() and hybrid transcription started');
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        toast.error('Failed to start recording. Please try again.');
      } finally {
        setIsStartingRecording(false);
      }
      return;
    }

    console.log('📝 Manual input mode');
    const hasManualInput = transcript.trim().length > 0 || context.trim().length > 0;
    if (hasManualInput) {
      await autoGenerateNote();
    }
  }, [isStartingRecording, isRecording, recordingMode, transcript, context, saveAllPendingChunks, stopRecording, startRecording, hybridTranscription]);

  const autoGenerateNote = useCallback(async (selectedTemplateId?: string) => {
    if (!id || !orchestratorRef.current) return;
    
    // Get the DIARIZED transcript with proper speaker labels
    const diarizedTranscript = getDiarizedTranscript();
    
    if (!diarizedTranscript || !diarizedTranscript.trim()) {
      toast.error("No transcript available to generate note");
      return;
    }

    const templateToUse = selectedTemplateId || template;

    console.log('🎯 Auto-generating clinical note with DIARIZED transcript');
    console.log('📄 Diarized transcript preview:', diarizedTranscript.substring(0, 200));

    try {
      setIsAutoPipelineRunning(true);
      setActiveTab('note');
      
      toast.info('Generating clinical documentation with speaker diarization...');
      setSaveStatus('saving');
      
      // Use the diarized transcript for maximum speaker accuracy
      const result = await orchestratorRef.current.runCompletePipeline(id, diarizedTranscript, {
        context,
        detailLevel: 'high',
        templateId: templateToUse,
      });
      
      if (result.success && result.note) {
        // Parse the note if it's wrapped in markdown code fences
        let parsedNoteJson = null;
        let cleanNote = result.note;
        
        try {
          // Check if the note is wrapped in ```json ... ```
          const jsonMatch = result.note.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            parsedNoteJson = JSON.parse(jsonMatch[1]);
            cleanNote = jsonMatch[1]; // Store the JSON string without code fences
          } else {
            // Try to parse it directly
            parsedNoteJson = JSON.parse(result.note);
          }
        } catch (e) {
          console.log('Note is not JSON format, using as plaintext');
        }
        
        setGeneratedNote(cleanNote);
        setNoteJson(parsedNoteJson);
        
        const { data: updatedSession } = await supabase
          .from('sessions')
          .select('note_json')
          .eq('id', id)
          .single();
        
        if (updatedSession?.note_json && !parsedNoteJson) {
          setNoteJson(updatedSession.note_json);
        }
        
        await updateSession.mutateAsync({ 
          id, 
          updates: { 
            generated_note: result.note, 
            status: 'review'
          } 
        });
        setSaveStatus('saved');
        toast.success('Clinical documentation complete!');
        
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('error');
        toast.error(result.errors?.[0] || 'Failed to generate note');
        setTimeout(() => setSaveStatus(null), 5000);
      }
    } catch (error) {
      console.error('Note generation error:', error);
      toast.error('An error occurred while generating the note');
    } finally {
      setIsAutoPipelineRunning(false);
    }
  }, [id, transcript, context, template]);

  const handlePauseRecording = useCallback(() => {
    console.log('🎯 PAUSE BUTTON CLICKED - Calling pauseRecording() and pausing hybrid transcription');
    pauseRecording();
    hybridTranscription.pause();
  }, [pauseRecording, hybridTranscription]);

  const handleResumeRecording = useCallback(() => {
    console.log('🎯 RESUME BUTTON CLICKED - Calling resumeRecording() and resuming hybrid transcription');
    resumeRecording();
    hybridTranscription.resume();
  }, [resumeRecording, hybridTranscription]);

  const handleStopRecording = useCallback(async () => {
    console.log('🎯 STOP BUTTON CLICKED - Stopping recording and opening template selection');
    toast.info('Stopping transcription...');
    
    // Stop hybrid transcription first
    hybridTranscription.stop();
    
    // Save any pending chunks first
    await saveAllPendingChunks();
    
    // Stop the recording
    stopRecording();
    
    // Open template selection dialog
    setTimeout(() => {
      setTemplateDialogOpen(true);
    }, 300);
  }, [saveAllPendingChunks, stopRecording, hybridTranscription]);

  const handleRecordingModeChange = useCallback((mode: string) => {
    setRecordingMode(mode);
    if (mode === 'dictating' || mode === 'upload' || mode === 'transcribing') {
      setActiveTab('transcript');
    }
    if (mode === 'upload') {
      setUploadDialogOpen(true);
    }
  }, []);

  const handleUploadRecording = useCallback(async (file: File, mode: "transcribe" | "dictate") => {
    if (!id) {
      toast.error('Session ID not found');
      return;
    }

    console.log('📁 Processing uploaded file:', { name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`, mode });
    
    try {
      // Mark as processing
      uploadProcessingRef.current = true;
      
      // Show loading indicator and start timer
      setIsUploadTranscribing(true);
      setUploadTranscriptionTime(0);
      
      // Start real-time timer
      uploadTimerRef.current = window.setInterval(() => {
        setUploadTranscriptionTime(prev => prev + 1);
      }, 1000);
      
      console.log('🎤 Starting file transcription...');
      
      // Convert file to base64 for transcription
      const reader = new FileReader();
      reader.onload = async () => {
        console.log('📄 File read complete, calling transcription API...');
        try {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          
          // Get the selected language code (en, hi, kn)
          const langCode = language === 'en-IN' ? 'en' : 
                           language === 'hi-IN' ? 'hi' : 
                           language === 'kn-IN' ? 'kn' : 'en';
          
          // Call transcription edge function with language
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: {
              audio: base64Data,
              session_id: id,
              language: langCode,
            },
          });

          if (error) throw error;

          console.log('✅ Transcription API successful');
          
          const transcriptText = data?.text || '';
          
          if (transcriptText) {
            const wordCount = transcriptText.split(' ').length;
            console.log('✅ Transcription completed:', wordCount, 'words');
            
            // Add speaker labels based on mode
            const labeledTranscript = mode === 'dictate' 
              ? `Doctor: ${transcriptText}`
              : transcriptText.split('\n').map((line, idx) => {
                  const speaker = idx % 2 === 0 ? 'Doctor' : 'Patient';
                  return `${speaker}: ${line}`;
                }).join('\n\n');
            
            // Set the transcript
            setTranscript(labeledTranscript);
            setActiveTab('transcript');
            
            toast.success(`Transcription completed! ${wordCount} words transcribed.`);
            
            // Auto-generate note after a brief delay
            setTimeout(() => {
              autoGenerateNote();
            }, 1000);
          } else {
            throw new Error('No transcript received from server');
          }
        } catch (error) {
          console.error('❌ Transcription error:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to transcribe audio');
        } finally {
          // Clear timer and reset
          if (uploadTimerRef.current) {
            clearInterval(uploadTimerRef.current);
            uploadTimerRef.current = null;
          }
          uploadProcessingRef.current = false;
          setIsUploadTranscribing(false);
          setUploadTranscriptionTime(0);
          setUploadDialogOpen(false);
        }
      };
      
      reader.onerror = () => {
        console.error('❌ File read error');
        // Clear timer and reset
        if (uploadTimerRef.current) {
          clearInterval(uploadTimerRef.current);
          uploadTimerRef.current = null;
        }
        uploadProcessingRef.current = false;
        setIsUploadTranscribing(false);
        setUploadTranscriptionTime(0);
        toast.error('Failed to read audio file');
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('❌ Upload processing error:', error);
      // Clear timer and reset
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      uploadProcessingRef.current = false;
      setIsUploadTranscribing(false);
      setUploadTranscriptionTime(0);
      toast.error('Failed to process audio file');
    }
  }, [id, language, autoGenerateNote]);

  // Handle dismissing the transcription overlay (background processing)
  const handleDismissTranscription = useCallback(() => {
    console.log('👋 Dismissing transcription overlay, continuing in background...');
    setIsUploadTranscribing(false);
    toast.info('Transcription continuing in background');
    navigate('/session/new');
  }, [navigate]);

  const handleGenerateNote = useCallback(async () => {
    // Get the DIARIZED transcript with proper speaker labels
    const diarizedTranscript = getDiarizedTranscript();
    
    if (!diarizedTranscript || !diarizedTranscript.trim()) {
      toast.error("Please add transcript content first");
      return;
    }

    if (!id || !session) {
      toast.error("Session not found");
      return;
    }

    if (!orchestratorRef.current) {
      toast.error("Workflow system not initialized");
      return;
    }

    console.log('🎯 Generating clinical note with DIARIZED transcript');
    console.log('📄 Diarized transcript preview:', diarizedTranscript.substring(0, 200));

    try {
      setIsAutoPipelineRunning(true);
      setSaveStatus('saving');
      
      // Use the diarized transcript for maximum speaker accuracy
      const result = await orchestratorRef.current.runCompletePipeline(id, diarizedTranscript, {
        context,
        detailLevel: 'high',
        templateId: template,
      });
      
      if (result.success && result.note) {
        // Parse the note if it's wrapped in markdown code fences
        let parsedNoteJson = null;
        let cleanNote = result.note;
        
        try {
          // Check if the note is wrapped in ```json ... ```
          const jsonMatch = result.note.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            parsedNoteJson = JSON.parse(jsonMatch[1]);
            cleanNote = jsonMatch[1]; // Store the JSON string without code fences
          } else {
            // Try to parse it directly
            parsedNoteJson = JSON.parse(result.note);
          }
        } catch (e) {
          console.log('Note is not JSON format, using as plaintext');
        }
        
        setGeneratedNote(cleanNote);
        setNoteJson(parsedNoteJson);
        
        const { data: updatedSession } = await supabase
          .from('sessions')
          .select('note_json')
          .eq('id', id)
          .single();
        
        if (updatedSession?.note_json && !parsedNoteJson) {
          setNoteJson(updatedSession.note_json);
        }
        
        await updateSession.mutateAsync({
          id,
          updates: {
            generated_note: result.note,
            status: 'review',
          },
        });

        setSaveStatus('saved');
        toast.success('Clinical documentation complete with speaker diarization!');
        
        setTimeout(() => setSaveStatus(null), 3000);
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Note completed with ${result.errors.length} optional step(s) failed`);
        }
      } else {
        setSaveStatus('error');
        toast.error(result.errors?.[0] || 'Failed to generate note');
        setTimeout(() => setSaveStatus(null), 5000);
      }
    } catch (error) {
      console.error('Workflow error:', error);
      toast.error('An error occurred during the workflow');
    } finally {
      setIsAutoPipelineRunning(false);
    }
  }, [getDiarizedTranscript, id, session, context, template]);

  const handleSessionDateChange = useCallback(async (newDate: Date) => {
    setSessionDate(newDate);
    
    // Update the session in the database with the new scheduled_at
    if (id) {
      try {
        await updateSession.mutateAsync({
          id,
          updates: { scheduled_at: newDate.toISOString() },
        });
        toast.success('Session scheduled successfully');
      } catch (error) {
        console.error('Error updating session date:', error);
        toast.error('Failed to update session date');
      }
    }
  }, [id]);

  const handlePatientNameChange = useCallback(async (newName: string) => {
    setPatientName(newName);
    
    // Update the session in the database
    if (id && newName !== session?.patient_name) {
      try {
        await updateSession.mutateAsync({
          id,
          updates: { patient_name: newName },
        });
      } catch (error) {
        console.error('Error updating patient name:', error);
      }
    }
  }, [id, session?.patient_name]);

  const handleFinishRecording = useCallback(async () => {
    if (!generatedNote) {
      toast.error("Please generate a note before finishing");
      return;
    }
    
    toast.success("Session saved!");
    navigate(`/session/${id}/review`);
  }, [generatedNote, navigate, id]);

  // Subscribe to real-time session updates
  const handleSessionUpdate = useCallback((updatedSession: any) => {
    console.log('Session updated in real-time on record page:', updatedSession);
    setPatientName(updatedSession.patient_name || "New Patient");
    
    // Parse generated_note if it's JSON wrapped in markdown
    let parsedNote = updatedSession.generated_note || "";
    let parsedJson = updatedSession.note_json || null;
    
    if (updatedSession.generated_note) {
      try {
        const jsonMatch = updatedSession.generated_note.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedNote = jsonMatch[1];
          parsedJson = JSON.parse(jsonMatch[1]);
        } else if (!updatedSession.note_json) {
          try {
            parsedJson = JSON.parse(updatedSession.generated_note);
          } catch (e) {
            // It's plaintext, keep as is
          }
        }
      } catch (e) {
        console.log('Could not parse note as JSON, using as plaintext');
      }
    }
    
    setGeneratedNote(parsedNote);
    setNoteJson(parsedJson);
    
    if (updatedSession.scheduled_at) {
      setSessionDate(new Date(updatedSession.scheduled_at));
    }
  }, []);

  useSessionUpdates(id || '', handleSessionUpdate);

  // EFFECTS LAST
  useEffect(() => {
    if (session) {
      setPatientName(session.patient_name || "New Patient");
      
      // Parse generated_note if it's JSON wrapped in markdown
      let parsedNote = session.generated_note || "";
      let parsedJson = session.note_json || null;
      
      if (session.generated_note) {
        try {
          const jsonMatch = session.generated_note.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            parsedNote = jsonMatch[1];
            parsedJson = JSON.parse(jsonMatch[1]);
          } else if (!session.note_json) {
            // Try to parse directly if note_json doesn't exist
            try {
              parsedJson = JSON.parse(session.generated_note);
            } catch (e) {
              // It's plaintext, keep as is
            }
          }
        } catch (e) {
          console.log('Could not parse note as JSON, using as plaintext');
        }
      }
      
      setGeneratedNote(parsedNote);
      setNoteJson(parsedJson);
      
      if (session.scheduled_at) {
        setSessionDate(new Date(session.scheduled_at));
      }
    }
  }, [session]);

  useEffect(() => {
    if (!session || !id) return;
    if (patientName === session.patient_name) return; // Skip if no change
    
    const timeoutId = setTimeout(async () => {
      await updateSession.mutateAsync({
        id,
        updates: { patient_name: patientName },
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [patientName, session?.patient_name, id]); // Removed updateSession, use session.patient_name specifically

  useEffect(() => {
    orchestratorRef.current = new WorkflowOrchestrator((state) => {
      setWorkflowState(state);
      setIsAutoPipelineRunning(state.isRunning);
    });
    
    return () => {
      orchestratorRef.current = null;
      // Clear upload timer on unmount
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
      }
    };
  }, []);

  // Auto-stop recording at 10 minutes maximum
  useEffect(() => {
    const MAX_DURATION = 600; // 10 minutes
    
    if (isRecording && duration >= MAX_DURATION) {
      console.log('⏱️ Maximum session duration reached (10 minutes)');
      toast.warning('Maximum session duration reached (10 minutes)', {
        description: 'Automatically stopping and generating note...'
      });
      
      // Auto-stop and generate note
      (async () => {
        await saveAllPendingChunks();
        stopRecording();
        
        setTimeout(async () => {
          await autoGenerateNote();
        }, 1000);
      })();
    }
  }, [isRecording, duration, saveAllPendingChunks, stopRecording, autoGenerateNote]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = now.getTime() - startTimeRef.current.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (id) {
      loadTranscripts();
    }
  }, [id]); // Removed loadTranscripts from deps - only load on id change

  useEffect(() => {
    const fullTranscript = getFullTranscript();
    if (fullTranscript) {
      setTranscript(fullTranscript);
    }
  }, [transcriptChunks]); // Removed getFullTranscript from deps - only update when chunks change

  useTranscriptUpdates(id || '', (newTranscript) => {
    loadTranscripts();
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Session not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Return to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Top Bar */}
        <SessionTopBar
          patientName={patientName}
          onPatientNameChange={handlePatientNameChange}
          sessionDate={sessionDate}
          onSessionDateChange={handleSessionDateChange}
          language={language}
          onLanguageChange={setLanguage}
          microphone={microphone}
          onMicrophoneChange={setMicrophone}
          elapsedTime={elapsedTime}
          recordingMode={recordingMode}
          onRecordingModeChange={handleRecordingModeChange}
          onStartRecording={handleStartTranscribing}
          onPauseRecording={handlePauseRecording}
          onResumeRecording={handleResumeRecording}
          onStopRecording={handleStopRecording}
          isRecording={isRecording}
          isPaused={isPaused}
          isStartingRecording={isStartingRecording}
          recordingInputMode={recordingInputMode}
          onRecordingInputModeChange={setRecordingInputMode}
          selectedTranscriptionModel={selectedTranscriptionModel}
          onModelChange={setSelectedTranscriptionModel}
        />

        {/* Voice Analysis Running in Background - UI Hidden */}
        {/* Voice analysis continues via useAudioRecording hook - currentVoiceCharacteristics updates in background */}

        {/* Workflow Progress - Hidden from UI but functionality preserved */}

        {/* Main Content */}
        <div className="flex-1 px-6 py-4 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            {/* Tab Navigation */}
            <TabsList className="w-fit mb-2 bg-transparent rounded-none h-auto p-0 gap-1">
              <TabsTrigger
                value="transcript"
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border data-[state=active]:border-primary"
              >
                <AudioLines className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <div className="w-px h-6 bg-border self-center" />
              <TabsTrigger
                value="context"
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border data-[state=active]:border-primary"
              >
                <ListPlus className="h-4 w-4" />
                Context
              </TabsTrigger>
              <div className="w-px h-6 bg-border self-center" />
              <TabsTrigger
                value="note"
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border data-[state=active]:border-primary"
              >
                <PencilLine className="h-4 w-4" />
                Note
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <TabsContent value="transcript" className="flex-1 mt-0 overflow-auto space-y-4">
              {/* Speaker Diarization working in background - UI hidden for cleaner interface */}
              {/* All speaker detection, voice analysis, and diarization continue via hooks */}
              
              {recordingMode === 'dictating' && (
                <DictatingPanel
                  sessionId={id}
                  onTranscriptUpdate={(t, isFinal) => {
                    if (isFinal) setTranscript(prev => prev ? `${prev}\n\n${t}` : t);
                  }}
                  onFinalTranscriptChunk={(t) => setTranscript(prev => prev ? `${prev}\n\n${t}` : t)}
                />
              )}
              {recordingMode === 'upload' && (
                <AudioUploadTranscription
                  sessionId={id}
                  onTranscriptGenerated={(t) => setTranscript(prev => prev ? `${prev}\n\n${t}` : t)}
                />
              )}
              <HeidiTranscriptPanel
                transcript={transcript}
                onTranscriptChange={setTranscript}
                stats={stats}
                isTranscribing={isTranscribing}
              />
            </TabsContent>

            <TabsContent value="context" className="flex-1 mt-0 overflow-auto">
              <HeidiContextPanel context={context} onContextChange={setContext} sessionId={id} />
            </TabsContent>

            <TabsContent value="note" className="flex-1 mt-0 overflow-auto">
              <HeidiNotePanel
                note={generatedNote}
                onNoteChange={setGeneratedNote}
                onGenerate={handleGenerateNote}
                isGenerating={isAutoPipelineRunning}
                sessionId={id}
                noteJson={noteJson}
                showFormatted={showFormattedNote}
                onToggleFormatted={() => setShowFormattedNote(!showFormattedNote)}
                selectedTemplate={template}
                onTemplateChange={setTemplate}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Ask Heidi Bar */}
        <AskHeidiBar sessionId={id} transcript={transcript} context={context} />
      </div>

      {/* Template Selection Dialog */}
      <TemplateSelectionDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSelectTemplate={(templateId) => {
          setTemplate(templateId);
          setTemplateDialogOpen(false);
          toast.info('Generating clinical note...');
          autoGenerateNote(templateId);
        }}
        isGenerating={isAutoPipelineRunning}
      />

      {/* Transcription Loading Overlay */}
      {isUploadTranscribing && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center cursor-pointer"
          onClick={handleDismissTranscription}
        >
          <div 
            className="bg-card border rounded-lg p-8 shadow-lg flex flex-col items-center gap-4 min-w-[320px] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Transcribing Audio</h3>
              <p className="text-sm text-muted-foreground mb-3">Processing your audio in real-time...</p>
              <div className="flex items-center justify-center gap-2 text-2xl font-mono font-bold text-primary">
                <span>{String(Math.floor(uploadTranscriptionTime / 60)).padStart(2, '0')}</span>
                <span className="animate-pulse">:</span>
                <span>{String(uploadTranscriptionTime % 60).padStart(2, '0')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Elapsed time</p>
              <p className="text-xs text-muted-foreground mt-4 italic">Click outside to continue in background</p>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default SessionRecord;