import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioLines, ListPlus, PencilLine } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { useTranscription } from "@/hooks/useTranscription";
import { useTranscriptUpdates } from "@/hooks/useRealtime";
import { WorkflowOrchestrator } from "@/utils/WorkflowOrchestrator";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import type { WorkflowState } from "@/utils/WorkflowOrchestrator";
import { HeidiInfoBar } from "@/components/session/HeidiInfoBar";
import { HeidiTranscriptPanel } from "@/components/session/HeidiTranscriptPanel";
import { HeidiContextPanel } from "@/components/session/HeidiContextPanel";
import { HeidiNotePanel } from "@/components/session/HeidiNotePanel";

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  const { transcriptChunks, addTranscriptChunk, loadTranscripts, getFullTranscript } = useTranscription(id || '');
  
  // State
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isAutoPipelineRunning, setIsAutoPipelineRunning] = useState(false);
  
  // Info bar state
  const [patientName, setPatientName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date());
  const [language, setLanguage] = useState("en");
  const [microphone, setMicrophone] = useState("default");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [recordingMode, setRecordingMode] = useState("transcribing");
  
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
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript);
      
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
      <div className="flex flex-col min-h-screen">
        {/* Top Info Bar */}
        <HeidiInfoBar
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
          onRecordingModeChange={setRecordingMode}
          sessionId={id}
          onTranscriptUpdate={(transcript, isFinal) => {
            if (!isFinal) {
              // Preview interim results
            }
          }}
          onFinalTranscriptChunk={handleTranscriptChunk}
          onRecordingComplete={handleAudioRecordingComplete}
        />

        {/* Workflow Progress */}
        {workflowState && (
          <div className="px-6 py-3">
            <WorkflowProgress state={workflowState} />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 px-6 py-4">
          <Tabs defaultValue="transcript" className="w-full">
            {/* Tab Navigation - compact tablist with separators */}
            <TabsList className="items-center p-1 text-text-secondary px-4 flex h-10 shrink-0 flex-row justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent w-full tabs-list-scrollbar mb-6">
              <TabsTrigger
                value="transcript"
                className="justify-center whitespace-nowrap text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-selected focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-outline data-[state=active]:text-text-primary hover:border hover:border-outline group flex items-center gap-x-1 rounded-sm border border-transparent px-2 py-1 text-text-secondary"
                data-testid="session-tab-transcript"
              >
                <AudioLines className="size-4 text-text-secondary group-hover:text-rose-500 group-data-[state=active]:text-rose-500" />
                <p className="text-sm font-normal leading-normal tracking-normal">Transcript</p>
              </TabsTrigger>
              <div role="none" className="shrink-0 bg-border w-px h-6" />
              <TabsTrigger
                value="context"
                className="justify-center whitespace-nowrap text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-selected focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-outline data-[state=active]:text-text-primary hover:border hover:border-outline group flex items-center gap-x-1 rounded-sm border border-transparent px-2 py-1 text-text-secondary"
                data-testid="session-tab-context"
              >
                <ListPlus className="size-4 text-text-secondary group-hover:text-pink-500 group-data-[state=active]:text-pink-500" />
                <p className="text-sm font-normal leading-normal tracking-normal">Context</p>
              </TabsTrigger>
              <div role="none" className="shrink-0 bg-border w-px h-6" />
              <TabsTrigger
                value="note"
                className="justify-center whitespace-nowrap text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-selected focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-outline data-[state=active]:text-text-primary hover:border hover:border-outline group flex items-center gap-x-1 rounded-sm border border-transparent px-2 py-1 text-text-secondary"
                data-testid="session-tab-note"
              >
                <PencilLine className="size-4 text-text-secondary group-hover:text-text-active group-data-[state=active]:text-text-active" />
                <div className="group flex items-center gap-x-1">
                  <p className="text-sm font-normal leading-normal tracking-normal">Note</p>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <TabsContent value="transcript" className="mt-0">
              <HeidiTranscriptPanel
                transcript={transcript}
                onTranscriptChange={setTranscript}
              />
            </TabsContent>

            <TabsContent value="context" className="mt-0">
              <HeidiContextPanel context={context} onContextChange={setContext} sessionId={id} />
            </TabsContent>

            <TabsContent value="note" className="mt-0">
              <HeidiNotePanel
                note={generatedNote}
                onNoteChange={setGeneratedNote}
                onGenerate={handleGenerateNote}
                isGenerating={isAutoPipelineRunning}
                sessionId={id}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default SessionRecord;
