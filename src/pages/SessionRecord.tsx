import { useState, useEffect, useRef, useCallback } from "react";
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
import { ExtremelyAdvancedVoiceVisualizationDashboard } from '@/components/ExtremelyAdvancedVoiceVisualizationDashboard';
import { ExtremelyAdvancedAutoCorrectorDashboard } from '@/components/ExtremelyAdvancedAutoCorrectorDashboard';
import { AdvancedTranscriptionDashboard } from '@/components/AdvancedTranscriptionDashboard';
import { RealtimeTranscriptionStatus } from '@/components/session/RealtimeTranscriptionStatus';
import { OpenAIRealtimeInterface } from '@/components/OpenAIRealtimeInterface';
import { useAdvancedTranscription } from '@/hooks/useAdvancedTranscription';
import { useRealtimeAdvancedTranscription } from '@/hooks/useRealtimeAdvancedTranscription';
import type { EnhancedTranscriptionData } from '@/types/advancedTranscription';

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  
  // ALL STATE HOOKS FIRST
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [template, setTemplate] = useState<"soap" | "progress" | "discharge" | "goldilocks">("soap");
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
  const [enhancedTranscriptionData, setEnhancedTranscriptionData] = useState<EnhancedTranscriptionData | null>(null);
  
  // ALL REFS NEXT
  const orchestratorRef = useRef<WorkflowOrchestrator | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date>(new Date());
  const speakerRef = useRef<'provider' | 'patient'>('provider');
  const transcriptCountRef = useRef(0);

  // CUSTOM HOOKS NEXT
  const { transcriptChunks, addTranscriptChunk, loadTranscripts, getFullTranscript, saveAllPendingChunks, stats } = useTranscription(id || '', 'unknown');
  const { processAudioWithFullAnalysis, isProcessing } = useAdvancedTranscription();
  const realtimeAdvanced = useRealtimeAdvancedTranscription(id || '');

  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    isPaused,
    duration,
    isTranscribing,
    currentVoiceGender,
    currentVoiceCharacteristics,
    voiceAnalyzer,
    autoCorrector,
  } = useAudioRecording({
    continuous: true,
    onTranscriptUpdate: (text: string, isFinal: boolean) => {
      if (isFinal && text.trim()) {
        const currentSpeaker = speakerRef.current;
        transcriptCountRef.current++;
        
        const speakerLabel = currentSpeaker === 'provider' ? 'Doctor' : 'Patient';
        setTranscript(prev => prev ? `${prev}\n\n**${speakerLabel}:** ${text}` : `**${speakerLabel}:** ${text}`);
        
        speakerRef.current = currentSpeaker === 'provider' ? 'patient' : 'provider';
      }
    },
    onRecordingComplete: async (audioBlob: Blob, audioUrl?: string) => {
      // Real-time mode handles its own completion
      if (recordingMode !== 'transcribing') {
        console.log('🎯 Recording complete, finalizing...');
      }
    },
    onError: (error: string) => {
      console.error('Recording error:', error);
      toast.error(error);
    },
  });

  // Update enhanced data from real-time transcription
  useEffect(() => {
    if (realtimeAdvanced.currentText) {
      setTranscript(realtimeAdvanced.currentText);
    }
    
    if (realtimeAdvanced.currentSegments.length > 0 || realtimeAdvanced.currentEntities.length > 0) {
      const enhancedData = realtimeAdvanced.getEnhancedData();
      setEnhancedTranscriptionData(enhancedData);
    }
  }, [realtimeAdvanced.currentText, realtimeAdvanced.currentSegments, realtimeAdvanced.currentEntities, realtimeAdvanced.getEnhancedData]);

  // CALLBACKS AFTER HOOKS
  const handleStartTranscribing = useCallback(async () => {
    if (isStartingRecording) {
      return;
    }

    if (isRecording || realtimeAdvanced.isTranscribing) {
      toast.info('Stopping transcription and generating clinical note...');
      
      if (realtimeAdvanced.isTranscribing) {
        await realtimeAdvanced.stopTranscription();
      } else {
        await saveAllPendingChunks();
        stopRecording();
      }
      
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
        setActiveTab('transcript');
        speakerRef.current = 'provider';
        transcriptCountRef.current = 0;
        
        if (recordingMode === 'transcribing') {
          // Use advanced real-time transcription
          toast.success('🚀 Starting ADVANCED real-time transcription with AI analysis...');
          await realtimeAdvanced.startTranscription();
        } else {
          toast.success('Starting live transcription... Speak now!');
          await startRecording();
        }
      } catch (error) {
        console.error('Failed to start recording:', error);
        toast.error('Failed to start recording. Please try again.');
      } finally {
        setIsStartingRecording(false);
      }
      return;
    }

    const hasManualInput = transcript.trim().length > 0 || context.trim().length > 0;
    if (hasManualInput) {
      await autoGenerateNote();
    }
  }, [isStartingRecording, isRecording, realtimeAdvanced, recordingMode, transcript, context, saveAllPendingChunks, stopRecording, startRecording]);

  const autoGenerateNote = useCallback(async () => {
    if (!id || !orchestratorRef.current) return;
    
    if (!transcript.trim()) {
      toast.error("No transcript available to generate note");
      return;
    }

    try {
      setIsAutoPipelineRunning(true);
      setActiveTab('note');
      
      toast.info(`Generating ${template.toUpperCase()} clinical documentation...`);
      setSaveStatus('saving');
      
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript, {
        context,
        detailLevel: 'high',
        template,
      });
      
      if (result.success && result.note) {
        setGeneratedNote(result.note);
        const { data: updatedSession } = await supabase
          .from('sessions')
          .select('note_json')
          .eq('id', id)
          .single();
        
        if (updatedSession?.note_json) {
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
  }, [id, transcript, context, template, updateSession]);

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
    toast.info(`Processing ${file.name}...`);
    console.log('Upload file:', file, 'Mode:', mode);
  }, []);

  const handleGenerateNote = useCallback(async () => {
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
      setSaveStatus('saving');
      
      const result = await orchestratorRef.current.runCompletePipeline(id, transcript, {
        context,
        detailLevel: 'high',
        template,
      });
      
      if (result.success && result.note) {
        setGeneratedNote(result.note);
        
        const { data: updatedSession } = await supabase
          .from('sessions')
          .select('note_json')
          .eq('id', id)
          .single();
        
        if (updatedSession?.note_json) {
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
        toast.success('Clinical documentation complete!');
        
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
  }, [transcript, id, session, context, template, updateSession]);

  const handleFinishRecording = useCallback(async () => {
    if (!generatedNote) {
      toast.error("Please generate a note before finishing");
      return;
    }
    
    toast.success("Session saved!");
    navigate(`/session/${id}/review`);
  }, [generatedNote, navigate, id]);

  // EFFECTS LAST
  useEffect(() => {
    if (session) {
      setPatientName(session.patient_name || "New Patient");
      setGeneratedNote(session.generated_note || "");
      setNoteJson(session.note_json || null);
      if (session.scheduled_at) {
        setSessionDate(new Date(session.scheduled_at));
      }
    }
  }, [session]);

  useEffect(() => {
    if (!session || !id) return;
    
    const timeoutId = setTimeout(async () => {
      if (patientName !== session.patient_name) {
        await updateSession.mutateAsync({
          id,
          updates: { patient_name: patientName },
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [patientName, session, id, updateSession]);

  useEffect(() => {
    orchestratorRef.current = new WorkflowOrchestrator((state) => {
      setWorkflowState(state);
      setIsAutoPipelineRunning(state.isRunning);
    });
    
    return () => {
      orchestratorRef.current = null;
    };
  }, []);

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
  }, [id, loadTranscripts]);

  useEffect(() => {
    const fullTranscript = getFullTranscript();
    if (fullTranscript) {
      setTranscript(fullTranscript);
    }
  }, [transcriptChunks, getFullTranscript]);

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
              {/* Real-time Advanced Transcription Status */}
              <RealtimeTranscriptionStatus
                isTranscribing={realtimeAdvanced.isTranscribing}
                processingStatus={realtimeAdvanced.processingStatus}
                speakerCount={realtimeAdvanced.speakerCount}
                segmentCount={realtimeAdvanced.currentSegments.length}
                entityCount={realtimeAdvanced.currentEntities.length}
                confidence={realtimeAdvanced.overallConfidence}
                currentText={realtimeAdvanced.currentText}
                interimText={realtimeAdvanced.interimText}
              />
              
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
                isTranscribing={isTranscribing || realtimeAdvanced.isTranscribing}
              />
              
              {/* OpenAI Realtime Voice Interface - Integrated */}
              {isRecording && (
                <div className="mt-6">
                  <OpenAIRealtimeInterface
                    sessionId={id}
                    onTranscriptUpdate={(text) => {
                      setTranscript(prev => prev + '\n' + text);
                    }}
                    onNoteUpdate={(note, noteJson) => {
                      setGeneratedNote(note);
                      setNoteJson(noteJson);
                    }}
                    onAnalysisUpdate={(analysis) => {
                      console.log('🧠 AI Analysis:', analysis);
                    }}
                  />
                </div>
              )}
              
              {/* Advanced Transcription Analysis */}
              {enhancedTranscriptionData && (
                <div className="mt-6">
                  <AdvancedTranscriptionDashboard data={enhancedTranscriptionData} />
                </div>
              )}
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
    </AppLayout>
  );
};

export default SessionRecord;