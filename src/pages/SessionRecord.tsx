import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  MicOff, 
  Square, 
  Save,
  MessageCircle,
  Clock,
  User,
  Calendar,
  FileText,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

const SessionRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [duration, setDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Placeholder patient data
  const sessionData = {
    patientName: "John Doe",
    patientId: "MRN-123456",
    dob: "1980-05-15",
    chiefComplaint: "Chest pain",
    appointmentType: "Initial Consultation",
    scheduledDate: "2025-10-10"
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      toast.success("Recording paused");
    } else {
      setIsRecording(true);
      toast.success("Recording started");
    }
  };

  const handleGenerateNote = async () => {
    if (!transcript.trim()) {
      toast.error("Please add transcript content first");
      return;
    }

    setIsGenerating(true);
    
    // Placeholder for AI note generation
    setTimeout(() => {
      setGeneratedNote(`SUBJECTIVE:
Patient presents with chief complaint of ${sessionData.chiefComplaint}. 
Patient reports symptoms began approximately 2 days ago...

OBJECTIVE:
Vital signs: BP 120/80, HR 72, Temp 98.6°F, RR 16
General appearance: Alert and oriented x3, no acute distress...

ASSESSMENT:
1. ${sessionData.chiefComplaint} - likely [diagnosis]
2. [Additional findings]

PLAN:
1. Order EKG and cardiac enzymes
2. Start aspirin 325mg
3. Follow up in 48 hours or sooner if symptoms worsen
4. Patient education provided regarding warning signs`);
      
      setIsGenerating(false);
      toast.success("Note generated successfully!");
    }, 2000);
  };

  const handleFinishRecording = () => {
    if (!generatedNote) {
      toast.error("Please generate a note before finishing");
      return;
    }
    
    toast.success("Session saved!");
    navigate(`/session/${id}/review`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recording Session</h1>
            <p className="text-muted-foreground">Patient: {sessionData.patientName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-mono">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
            </div>
            <Badge variant={isRecording ? "destructive" : "secondary"} className="text-sm">
              {isRecording ? "Recording" : "Paused"}
            </Badge>
          </div>
        </div>

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
                <Card>
                  <CardHeader>
                    <CardTitle>Live Transcription</CardTitle>
                    <CardDescription>
                      Type or speak to capture the clinical encounter
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Start typing or recording the clinical encounter..."
                      className="min-h-[400px] font-mono text-sm"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                    
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant={isRecording ? "destructive" : "default"}
                        onClick={handleToggleRecording}
                        className="flex-1"
                      >
                        {isRecording ? (
                          <>
                            <MicOff className="mr-2 h-4 w-4" />
                            Pause Recording
                          </>
                        ) : (
                          <>
                            <Mic className="mr-2 h-4 w-4" />
                            Start Recording
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={handleGenerateNote}
                        disabled={isGenerating || !transcript.trim()}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Note
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
                        <p className="font-medium">{sessionData.patientName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Patient ID</p>
                        <p className="font-medium">{sessionData.patientId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Birth</p>
                        <p className="font-medium">{sessionData.dob}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Appointment Date</p>
                        <p className="font-medium">{sessionData.scheduledDate}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chief Complaint</p>
                      <p className="font-medium">{sessionData.chiefComplaint}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Appointment Type</p>
                      <Badge variant="secondary">{sessionData.appointmentType}</Badge>
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
                  <p className="font-medium">{sessionData.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MRN</p>
                  <p className="font-medium">{sessionData.patientId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chief Complaint</p>
                  <p className="font-medium">{sessionData.chiefComplaint}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Ask Heidi
                </CardTitle>
                <CardDescription>AI clinical assistant</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
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
      </div>
    </AppLayout>
  );
};

export default SessionRecord;
