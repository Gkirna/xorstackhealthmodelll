import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Square, 
  Save,
  MessageCircle,
  User,
  FileText,
  Loader2,
  Zap
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recording Session</h1>
            <p className="text-muted-foreground">Patient: {session.patient_name}</p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {session.status}
          </Badge>
        </div>

        {workflowState && <WorkflowProgress state={workflowState} />}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Recording Area */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="transcript" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="note">AI Note</TabsTrigger>
                <TabsTrigger value="context">Context</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transcript" className="space-y-4">
                <Tabs defaultValue="record" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="record">Record Live</TabsTrigger>
                    <TabsTrigger value="upload">Upload Audio</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="record" className="mt-4">
                    <AudioRecorderWithTranscription 
                      sessionId={id}
                      onTranscriptUpdate={(text, isFinal) => {
                        // Update display with interim results
                        if (!isFinal) {
                          // Could show interim in a different color/style
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
                
                <Card>
                  <CardHeader>
                    <CardTitle>Transcript</CardTitle>
                    <CardDescription>
                      Manual entry or transcribed text will appear here
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Type or record the clinical encounter..."
                      className="min-h-[300px] font-mono text-sm"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                    
                    <div className="flex gap-3 mt-4">
                      <Button
                        onClick={handleGenerateNote}
                        disabled={isAutoPipelineRunning || !transcript.trim()}
                        className="flex-1"
                      >
                        {isAutoPipelineRunning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            Generate Note & Extract Tasks
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="note" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>AI-Generated Note</CardTitle>
                    <CardDescription>
                      Structured clinical note based on the transcript
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {generatedNote ? (
                      <div className="min-h-[400px] p-4 bg-muted rounded-lg whitespace-pre-wrap font-mono text-sm">
                        {generatedNote}
                      </div>
                    ) : (
                      <div className="min-h-[400px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center space-y-3">
                          <FileText className="h-12 w-12 mx-auto opacity-20" />
                          <p>No note generated yet</p>
                          <p className="text-sm">Add transcript content and click "Generate Note"</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="context" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Context</CardTitle>
                    <CardDescription>Patient and appointment details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Patient Name</p>
                        <p className="font-medium">{session.patient_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Patient ID</p>
                        <p className="font-medium">{session.patient_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Birth</p>
                        <p className="font-medium">{session.patient_dob || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Appointment Date</p>
                        <p className="font-medium">{session.scheduled_at ? new Date(session.scheduled_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chief Complaint</p>
                      <p className="font-medium">{session.chief_complaint || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Appointment Type</p>
                      <Badge variant="secondary">{session.appointment_type || 'N/A'}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{session.patient_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MRN</p>
                  <p className="font-medium">{session.patient_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chief Complaint</p>
                  <p className="font-medium">{session.chief_complaint || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {generatedNote && (
              <ExportOptions 
                sessionId={id || ''}
                noteContent={generatedNote}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Ask Heidi
                </CardTitle>
                <CardDescription>AI clinical assistant</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setHeidiDrawerOpen(true)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Open Chat
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/dashboard")}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button 
                className="w-full"
                onClick={handleFinishRecording}
                disabled={!generatedNote}
              >
                <Square className="mr-2 h-4 w-4" />
                Finish & Review
              </Button>
            </div>
          </div>
        </div>

        <AskHeidiDrawer 
          open={heidiDrawerOpen}
          onOpenChange={setHeidiDrawerOpen}
          session_id={id}
        />
      </div>
    </AppLayout>
  );
};

export default SessionRecord;
