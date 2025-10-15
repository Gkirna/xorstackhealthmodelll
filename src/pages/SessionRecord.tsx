import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Square, 
  Save,
  MessageCircle,
  User,
  FileText,
  Loader2,
  Zap,
  Mic
} from "lucide-react";
import { toast } from "sonner";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { AudioRecorderWithTranscription } from "@/components/AudioRecorderWithTranscription";
import { AudioUploadTranscription } from "@/components/AudioUploadTranscription";
import { AskHeidiDrawer } from "@/components/AskHeidiDrawer";
import { useTranscription } from "@/hooks/useTranscription";
import { useTranscriptUpdates } from "@/hooks/useRealtime";
import { ExportOptions } from "@/components/ExportOptions";
import { WorkflowOrchestrator } from "@/utils/WorkflowOrchestrator";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import { SessionTimeline } from "@/components/session/SessionTimeline";
import { PatientContextCard } from "@/components/session/PatientContextCard";
import { SessionEditor } from "@/components/session/SessionEditor";
import { TutorialCard } from "@/components/session/TutorialCard";
import type { WorkflowState } from "@/utils/WorkflowOrchestrator";

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  const { transcriptChunks, addTranscriptChunk, loadTranscripts, getFullTranscript } = useTranscription(id || '');
  
  const [transcript, setTranscript] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [heidiDrawerOpen, setHeidiDrawerOpen] = useState(false);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isAutoPipelineRunning, setIsAutoPipelineRunning] = useState(false);
  
  const orchestratorRef = useRef<WorkflowOrchestrator | null>(null);

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

  const handleFinishRecording = () => {
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
      <div className="flex gap-8 min-h-screen">
        {/* Left Column: Timeline & Context */}
        <div className="w-[280px] flex-shrink-0 space-y-6">
          <SessionTimeline />
          <PatientContextCard
            patientName={session.patient_name}
            patientId={session.patient_id}
            chiefComplaint={session.chief_complaint || ''}
          />
        </div>

        {/* Center Column: Main Editor */}
        <div className="flex-1 min-w-0 space-y-6">
          {workflowState && <WorkflowProgress state={workflowState} />}

          {/* Recording Controls */}
          <Card className="p-6 rounded-2xl border-border">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Select defaultValue="default">
                  <SelectTrigger className="w-[220px] h-12 rounded-xl border-input focus:border-primary">
                    <SelectValue placeholder="Select microphone..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Microphone</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  size="lg"
                  className="flex-1 h-12 rounded-3xl bg-primary hover:bg-primary-hover shadow-button transition-all hover:scale-105 active:scale-98"
                  onClick={() => {/* Start recording */}}
                >
                  <Mic className="h-5 w-5 mr-2" />
                  Start Transcribing
                </Button>
              </div>

              <Tabs defaultValue="record" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50 rounded-xl">
                  <TabsTrigger value="record" className="rounded-lg">
                    Record Live
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="rounded-lg">
                    Upload Audio
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="record" className="mt-4">
                  <AudioRecorderWithTranscription 
                    sessionId={id}
                    onTranscriptUpdate={(text, isFinal) => {
                      if (!isFinal) {
                        // Show interim results
                      }
                    }}
                    onFinalTranscriptChunk={handleTranscriptChunk}
                    onRecordingComplete={handleAudioRecordingComplete}
                  />
                </TabsContent>
                
                <TabsContent value="upload" className="mt-4">
                  <AudioUploadTranscription 
                    sessionId={id}
                    onTranscriptGenerated={handleTranscriptChunk}
                    onAudioUploaded={(url) => console.log('Audio uploaded:', url)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          {/* Session Editor */}
          <SessionEditor
            transcript={transcript}
            generatedNote={generatedNote}
            onTranscriptChange={setTranscript}
          />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="lg"
              className="flex-1 h-12 rounded-xl"
              onClick={() => navigate("/dashboard")}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button 
              size="lg"
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary-hover"
              onClick={handleFinishRecording}
              disabled={!generatedNote}
            >
              <Square className="mr-2 h-4 w-4" />
              Finish & Review
            </Button>
          </div>
        </div>

        {/* Right Column: Tutorials & Export */}
        <div className="w-[260px] flex-shrink-0 space-y-6">
          <TutorialCard />
          
          {generatedNote && (
            <ExportOptions 
              sessionId={id || ''}
              noteContent={generatedNote}
            />
          )}
        </div>
      </div>

      <AskHeidiDrawer 
        open={heidiDrawerOpen}
        onOpenChange={setHeidiDrawerOpen}
        session_id={id}
      />
    </AppLayout>
  );
};

export default SessionRecord;
