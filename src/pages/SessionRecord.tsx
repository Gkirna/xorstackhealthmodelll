import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioLines, ListPlus, PencilLine } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { useTranscription } from "@/hooks/useTranscription";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useTranscriptUpdates } from "@/hooks/useRealtime";
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
// removed bottom alert block

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  const { transcriptChunks, addTranscriptChunk, loadTranscripts, getFullTranscript } = useTranscription(id || '');
  
  // Speaker tracking (alternates between doctor and patient)
  const speakerRef = useRef<'provider' | 'patient'>('provider');
  const transcriptCountRef = useRef(0);

  // Memoized callback to prevent audio recorder reinitialization
  const handleTranscriptUpdate = useCallback((text: string, isFinal: boolean) => {
    if (isFinal && text.trim()) {
      // Alternate speaker for each transcript chunk
      const currentSpeaker = speakerRef.current;
      transcriptCountRef.current++;
      
      console.log(`💬 Transcript chunk #${transcriptCountRef.current} from ${currentSpeaker}:`, text.substring(0, 50));
      
      // Save to database with speaker label
      addTranscriptChunk(text, currentSpeaker);
      
      // Update local transcript with speaker label
      const speakerLabel = currentSpeaker === 'provider' ? 'Doctor' : 'Patient';
      setTranscript(prev => prev ? `${prev}\n\n**${speakerLabel}:** ${text}` : `**${speakerLabel}:** ${text}`);
      
      // Alternate to next speaker
      speakerRef.current = currentSpeaker === 'provider' ? 'patient' : 'provider';
    }
  }, [addTranscriptChunk]);

  const handleRecordingError = useCallback((error: string) => {
    console.error('Recording error:', error);
    toast.error(error);
  }, []);

  // Real-time audio recording & transcription
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    isPaused,
    duration,
    isTranscribing,
  } = useAudioRecording({
    continuous: true,
    onTranscriptUpdate: handleTranscriptUpdate,
    onError: handleRecordingError,
  });

  // Start mic transcription and automatically generate note when stopped
  const handleStartTranscribing = async () => {
    // Prevent multiple simultaneous calls
    if (isStartingRecording) {
      return;
    }

    if (isRecording) {
      // Stop recording and auto-generate note
      toast.info('Stopping transcription and generating clinical note...');
      stopRecording();
      
      // Wait a moment for final transcript to be saved
      setTimeout(async () => {
        await autoGenerateNote();
      }, 1500);
      return;
    }

    if (recordingMode === 'upload') {
      toast.info('Upload flow coming soon. Please use Dictating or Transcribing for now.');
      return;
    }

    if (recordingMode === 'dictating' || recordingMode === 'transcribing') {
      setIsStartingRecording(true);
      
      try {
        // Start new recording session
        setActiveTab('transcript');
        speakerRef.current = 'provider'; // Reset to doctor
        transcriptCountRef.current = 0;
        toast.success('Starting live transcription... Speak now!');
        
        await startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
        toast.error('Failed to start recording. Please try again.');
      } finally {
        setIsStartingRecording(false);
      }
      return;
    }

    // If manual input exists, generate note immediately
    const hasManualInput = transcript.trim().length > 0 || context.trim().length > 0;
    if (hasManualInput) {
      await autoGenerateNote();
    }
  };

  // Auto-generate clinical note from transcript
  const autoGenerateNote = async () => {
    if (!id || !orchestratorRef.current) return;
    
    if (!transcript.trim()) {
      toast.error("No transcript available to generate note");
      return;
    }

    try {
      setIsAutoPipelineRunning(true);
      setActiveTab('note'); // Switch to note tab
      
      toast.info('Generating clinical documentation...');
      
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript, {
        context,
        detailLevel: 'high',
      });
      
      if (result.success && result.note) {
        setGeneratedNote(result.note);
        await updateSession.mutateAsync({ 
          id, 
          updates: { 
            generated_note: result.note, 
            status: 'review'
          } 
        });
        toast.success('Clinical documentation complete!');
      } else {
        toast.error(result.errors?.[0] || 'Failed to generate note');
      }
    } catch (error) {
      console.error('Note generation error:', error);
      toast.error('An error occurred while generating the note');
    } finally {
      setIsAutoPipelineRunning(false);
    }
  };

  const handleRecordingModeChange = (mode: string) => {
    setRecordingMode(mode);
    if (mode === 'dictating' || mode === 'upload' || mode === 'transcribing') {
      setActiveTab('transcript');
    }
    if (mode === 'upload') {
      setUploadDialogOpen(true);
    }
  };

  const handleUploadRecording = async (file: File, mode: "transcribe" | "dictate") => {
    toast.info(`Processing ${file.name}...`);
    // TODO: Implement audio file upload and transcription
    console.log('Upload file:', file, 'Mode:', mode);
  };
  
  // State
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [template, setTemplate] = useState<"soap" | "progress" | "discharge" | "goldilocks">("soap");
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isAutoPipelineRunning, setIsAutoPipelineRunning] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  
  // Info bar state
  const [patientName, setPatientName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date());
  const [language, setLanguage] = useState("en");
  const [microphone, setMicrophone] = useState("default");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [recordingMode, setRecordingMode] = useState("transcribing");
  const [activeTab, setActiveTab] = useState<string>("note");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  const orchestratorRef = useRef<WorkflowOrchestrator | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Initialize session data
  useEffect(() => {
    if (session) {
      setPatientName(session.patient_name || "New Patient");
      if (session.scheduled_at) {
        setSessionDate(new Date(session.scheduled_at));
      }
    }
  }, [session]);

  // Auto-save patient name on change
  useEffect(() => {
    if (!session || !id) return;
    
    const timeoutId = setTimeout(async () => {
      if (patientName !== session.patient_name) {
        await updateSession.mutateAsync({
          id,
          updates: { patient_name: patientName },
        });
      }
    }, 1000); // Debounce by 1 second

    return () => clearTimeout(timeoutId);
  }, [patientName, session, id, updateSession]);

  // Initialize workflow orchestrator
  useEffect(() => {
    orchestratorRef.current = new WorkflowOrchestrator((state) => {
      setWorkflowState(state);
      setIsAutoPipelineRunning(state.isRunning);
    });
    
    return () => {
      orchestratorRef.current = null;
    };
  }, []);

  // Timer for elapsed time
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

  // Load existing transcripts
  useEffect(() => {
    if (id) {
      loadTranscripts();
    }
  }, [id, loadTranscripts]);

  // Update transcript when chunks change
  useEffect(() => {
    const fullTranscript = getFullTranscript();
    if (fullTranscript) {
      setTranscript(fullTranscript);
    }
  }, [transcriptChunks, getFullTranscript]);

  // Subscribe to realtime transcript updates
  useTranscriptUpdates(id || '', (newTranscript) => {
    loadTranscripts();
  });

  // Handle real-time transcript chunks from audio recorder
  const handleTranscriptChunk = async (text: string) => {
    if (!text.trim() || !id) return;
    
    // Save to database
    await addTranscriptChunk(text, 'provider');
    
    // Update local transcript
    setTranscript(prev => prev ? `${prev}\n\n${text}` : text);
  };

  const handleAudioRecordingComplete = async (audioBlob: Blob, audioUrl?: string) => {
    console.log('Audio recording complete, size:', audioBlob.size);
    
    if (audioUrl && id) {
      // Update session with audio URL
      await updateSession.mutateAsync({
        id,
        updates: {
          // Note: You may need to add an audio_url column to sessions table
        }
      });
      
      toast.success('Recording saved');
    }
  };

  const handleGenerateNote = async () => {
    if (!transcript.trim()) {
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

    try {
      setIsAutoPipelineRunning(true);
      
      // Run the complete auto-pipeline
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript, {
        context,
        detailLevel: 'high',
      });
      
      if (result.success && result.note) {
        setGeneratedNote(result.note);
        
        // Update session with all results
        await updateSession.mutateAsync({
          id,
          updates: {
            generated_note: result.note,
            status: 'review',
          },
        });

        toast.success('Clinical documentation complete!');
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Note completed with ${result.errors.length} optional step(s) failed`);
        }
      } else {
        toast.error(result.errors?.[0] || 'Failed to generate note');
      }
    } catch (error) {
      console.error('Workflow error:', error);
      toast.error('An error occurred during the workflow');
    } finally {
      setIsAutoPipelineRunning(false);
    }
  };

  const handleFinishRecording = async () => {
    if (!generatedNote) {
      toast.error("Please generate a note before finishing");
      return;
    }
    
    toast.success("Session saved!");
    navigate(`/session/${id}/review`);
  };

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
          onPatientNameChange={setPatientName}
          sessionDate={sessionDate}
          onSessionDateChange={setSessionDate}
          language={language}
          onLanguageChange={setLanguage}
          microphone={microphone}
          onMicrophoneChange={setMicrophone}
          elapsedTime={elapsedTime}
          recordingMode={recordingMode}
          onRecordingModeChange={handleRecordingModeChange}
          onStartRecording={handleStartTranscribing}
          isRecording={isRecording}
          isStartingRecording={isStartingRecording}
        />

        {/* Workflow Progress */}
        {workflowState && (
          <div className="px-6 py-3">
            <WorkflowProgress state={workflowState} />
          </div>
        )}

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
                selectedTemplate={template}
                onTemplateChange={setTemplate}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Ask Heidi Bar */}
        <AskHeidiBar sessionId={id} transcript={transcript} context={context} />

        
      </div>
    </AppLayout>
  );
};

export default SessionRecord;
