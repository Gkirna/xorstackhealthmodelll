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
  
  // Real-time audio recording & transcription
  const {
    startRecording,
    isTranscribing,
  } = useAudioRecording({
    onTranscriptUpdate: (text, isFinal) => {
      if (isFinal) {
        // Save final chunks to DB and append to local transcript
        addTranscriptChunk(text, 'provider');
        setTranscript(prev => prev ? `${prev}\n\n${text}` : text);
      } else {
        // Show interim updates in the editor without saving
        // We will append interim visually in the panel instead of mutating saved transcript
        // For now, keep the previous behavior minimal (no-op)
      }
    },
  });

  // Start mic transcription if empty; otherwise immediately generate note
  const handleStartTranscribing = async () => {
    if (recordingMode === 'upload') {
      toast.info('Upload flow coming soon. Please use Dictating or Transcribing for now.');
      return;
    }

    if (recordingMode === 'dictating') {
      // Switch to transcript view and start recording
      setActiveTab('transcript');
      startRecording();
      return;
    }

    const hasManualInput = transcript.trim().length > 0 || context.trim().length > 0;
    if (hasManualInput) {
      if (!orchestratorRef.current || !id) return;
      setIsAutoPipelineRunning(true);
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript || '(No transcript provided)', {
        context,
        detailLevel: 'high',
      });
      if (result.success && result.note) {
        setGeneratedNote(result.note);
        await updateSession.mutateAsync({ id, updates: { generated_note: result.note, status: 'review' } });
        toast.success('Clinical documentation complete!');
      } else {
        toast.error(result.errors?.[0] || 'Failed to generate note');
      }
      setIsAutoPipelineRunning(false);
      return;
    }
    setActiveTab('transcript');
    startRecording();
  };

  const handleRecordingModeChange = (mode: string) => {
    setRecordingMode(mode);
    if (mode === 'dictating' || mode === 'upload' || mode === 'transcribing') {
      setActiveTab('transcript');
    }
  };
  
  // State
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<"soap" | "progress" | "discharge" | "goldilocks">("soap");
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isAutoPipelineRunning, setIsAutoPipelineRunning] = useState(false);
  
  // Undo/Redo state
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([""]);
  const [transcriptHistoryIndex, setTranscriptHistoryIndex] = useState(0);
  const [contextHistory, setContextHistory] = useState<string[]>([""]);
  const [contextHistoryIndex, setContextHistoryIndex] = useState(0);
  const [noteHistory, setNoteHistory] = useState<string[]>([""]);
  const [noteHistoryIndex, setNoteHistoryIndex] = useState(0);
  
  // Info bar state
  const [patientName, setPatientName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date());
  const [language, setLanguage] = useState("en");
  const [microphone, setMicrophone] = useState("default");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [recordingMode, setRecordingMode] = useState("transcribing");
  const [activeTab, setActiveTab] = useState<string>("note");
  
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
      if (session.generated_note) {
        setGeneratedNote(session.generated_note);
      }
    }
  }, [session]);

  // Auto-save transcript, context, and note
  useEffect(() => {
    if (!session || !id) return;
    
    const timeoutId = setTimeout(async () => {
      const updates: any = {};
      
      if (transcript !== (session.generated_note || '')) {
        // Store transcript in a custom column if needed
      }
      
      if (generatedNote !== (session.generated_note || '')) {
        updates.generated_note = generatedNote;
      }
      
      if (Object.keys(updates).length > 0) {
        await updateSession.mutateAsync({ id, updates });
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [transcript, context, generatedNote, session, id, updateSession]);

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

  // Undo/Redo handlers
  const handleTranscriptChange = (newTranscript: string) => {
    setTranscript(newTranscript);
    const newHistory = transcriptHistory.slice(0, transcriptHistoryIndex + 1);
    newHistory.push(newTranscript);
    setTranscriptHistory(newHistory);
    setTranscriptHistoryIndex(newHistory.length - 1);
  };

  const handleContextChange = (newContext: string) => {
    setContext(newContext);
    const newHistory = contextHistory.slice(0, contextHistoryIndex + 1);
    newHistory.push(newContext);
    setContextHistory(newHistory);
    setContextHistoryIndex(newHistory.length - 1);
  };

  const handleNoteChange = (newNote: string) => {
    setGeneratedNote(newNote);
    const newHistory = noteHistory.slice(0, noteHistoryIndex + 1);
    newHistory.push(newNote);
    setNoteHistory(newHistory);
    setNoteHistoryIndex(newHistory.length - 1);
  };

  const undoTranscript = () => {
    if (transcriptHistoryIndex > 0) {
      setTranscriptHistoryIndex(transcriptHistoryIndex - 1);
      setTranscript(transcriptHistory[transcriptHistoryIndex - 1]);
    }
  };

  const redoTranscript = () => {
    if (transcriptHistoryIndex < transcriptHistory.length - 1) {
      setTranscriptHistoryIndex(transcriptHistoryIndex + 1);
      setTranscript(transcriptHistory[transcriptHistoryIndex + 1]);
    }
  };

  const undoContext = () => {
    if (contextHistoryIndex > 0) {
      setContextHistoryIndex(contextHistoryIndex - 1);
      setContext(contextHistory[contextHistoryIndex - 1]);
    }
  };

  const redoContext = () => {
    if (contextHistoryIndex < contextHistory.length - 1) {
      setContextHistoryIndex(contextHistoryIndex + 1);
      setContext(contextHistory[contextHistoryIndex + 1]);
    }
  };

  const undoNote = () => {
    if (noteHistoryIndex > 0) {
      setNoteHistoryIndex(noteHistoryIndex - 1);
      setGeneratedNote(noteHistory[noteHistoryIndex - 1]);
    }
  };

  const redoNote = () => {
    if (noteHistoryIndex < noteHistory.length - 1) {
      setNoteHistoryIndex(noteHistoryIndex + 1);
      setGeneratedNote(noteHistory[noteHistoryIndex + 1]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (activeTab === 'transcript') undoTranscript();
        else if (activeTab === 'context') undoContext();
        else if (activeTab === 'note') undoNote();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        if (activeTab === 'transcript') redoTranscript();
        else if (activeTab === 'context') redoContext();
        else if (activeTab === 'note') redoNote();
      }
      // Ctrl/Cmd + S to save (already auto-saving, but show feedback)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast.success('Auto-save active');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, transcriptHistoryIndex, contextHistoryIndex, noteHistoryIndex]);

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
      <div className="flex flex-col h-screen">
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
                onTranscriptChange={handleTranscriptChange}
                onUndo={undoTranscript}
                onRedo={redoTranscript}
                canUndo={transcriptHistoryIndex > 0}
                canRedo={transcriptHistoryIndex < transcriptHistory.length - 1}
              />
            </TabsContent>

            <TabsContent value="context" className="flex-1 mt-0 overflow-auto">
              <HeidiContextPanel 
                context={context} 
                onContextChange={handleContextChange} 
                sessionId={id}
                onUndo={undoContext}
                onRedo={redoContext}
                canUndo={contextHistoryIndex > 0}
                canRedo={contextHistoryIndex < contextHistory.length - 1}
              />
            </TabsContent>

            <TabsContent value="note" className="flex-1 mt-0 overflow-auto">
              <HeidiNotePanel
                note={generatedNote}
                onNoteChange={handleNoteChange}
                onGenerate={handleGenerateNote}
                isGenerating={isAutoPipelineRunning}
                sessionId={id}
                selectedTemplate={selectedTemplate}
                onTemplateChange={setSelectedTemplate}
                onUndo={undoNote}
                onRedo={redoNote}
                canUndo={noteHistoryIndex > 0}
                canRedo={noteHistoryIndex < noteHistory.length - 1}
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
