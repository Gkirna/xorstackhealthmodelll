import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Copy, 
  Download, 
  Mail,
  CheckCircle2,
  FileText,
  Stethoscope,
  ClipboardList,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { extractTasks, suggestCodes, exportNote } from "@/lib/api";
import { ExportOptions } from "@/components/ExportOptions";
import { useTaskUpdates } from "@/hooks/useRealtime";
import { useAuth } from "@/hooks/useAuth";

const SessionReview = () => {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [session, setSession] = useState<any>(null);
  const [noteContent, setNoteContent] = useState("");
  const [detailLevel, setDetailLevel] = useState("medium");
  const [status, setStatus] = useState("draft");
  const [icdCodes, setIcdCodes] = useState<any[]>([]);
  const [extractedTasks, setExtractedTasks] = useState<any[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [isSuggestingCodes, setIsSuggestingCodes] = useState(false);

  // Subscribe to real-time task updates
  useTaskUpdates(user?.id || '', (task) => {
    if (task.session_id === sessionId) {
      setExtractedTasks(prev => {
        const exists = prev.find(t => t.id === task.id);
        if (exists) {
          return prev.map(t => t.id === task.id ? task : t);
        }
        return [...prev, task];
      });
    }
  });

  // Load session data
  useEffect(() => {
    if (!sessionId) return;
    
    const loadSession = async () => {
      try {
        setIsLoadingSession(true);
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          toast.error('Session not found');
          navigate('/sessions');
          return;
        }

        setSession(data);
        setNoteContent(data.generated_note || '');
        setStatus(data.status || 'draft');
        
        // Parse clinical codes if they exist
        if (data.clinical_codes) {
          setIcdCodes(Array.isArray(data.clinical_codes) ? data.clinical_codes : []);
        }

        // Load tasks for this session
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('session_id', sessionId)
          .order('priority', { ascending: false });

        if (!tasksError && tasks) {
          setExtractedTasks(tasks);
        }

      } catch (error) {
        console.error('Error loading session:', error);
        toast.error('Failed to load session');
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadSession();
  }, [sessionId, navigate]);

  // Auto-extract tasks and codes when note is generated
  useEffect(() => {
    if (noteContent && sessionId && extractedTasks.length === 0) {
      handleExtractTasks();
    }
    if (noteContent && sessionId && icdCodes.length === 0) {
      handleSuggestCodes();
    }
  }, [noteContent, sessionId]);

  const handleExtractTasks = async () => {
    if (!sessionId || !noteContent) return;
    
    try {
      setIsExtractingTasks(true);
      console.log('Extracting tasks for session:', sessionId);
      const result = await extractTasks(sessionId, noteContent);
      
      if (result.success && result.data) {
        toast.success(`Extracted ${result.data.length} tasks`);
        setExtractedTasks(result.data);
      } else {
        toast.error('Failed to extract tasks');
      }
    } catch (error) {
      console.error('Task extraction error:', error);
      toast.error('Failed to extract tasks');
    } finally {
      setIsExtractingTasks(false);
    }
  };

  const handleSuggestCodes = async () => {
    if (!sessionId || !noteContent) return;
    
    try {
      setIsSuggestingCodes(true);
      console.log('Suggesting codes for session:', sessionId);
      const result = await suggestCodes(sessionId, noteContent, session?.region || 'US');
      
      if (result.success && result.data) {
        toast.success(`Found ${result.data.length} ICD-10 codes`);
        setIcdCodes(result.data);
        
        // Save codes to session
        await supabase
          .from('sessions')
          .update({ clinical_codes: result.data })
          .eq('id', sessionId);
      } else {
        toast.error('Failed to suggest codes');
      }
    } catch (error) {
      console.error('Code suggestion error:', error);
      toast.error('Failed to suggest codes');
    } finally {
      setIsSuggestingCodes(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(noteContent);
    toast.success("Note copied to clipboard!");
  };

  const handleSaveNote = async () => {
    if (!sessionId) return;
    
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ 
          generated_note: noteContent,
          status: 'draft'
        })
        .eq('id', sessionId);

      if (error) throw error;
      toast.success('Note saved as draft');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save note');
    }
  };

  const handleFinalize = async () => {
    if (!sessionId) return;
    
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ 
          generated_note: noteContent,
          status: 'finalized'
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      setStatus("finalized");
      toast.success("Note finalized and saved!");
      setTimeout(() => navigate("/sessions"), 1500);
    } catch (error) {
      console.error('Finalize error:', error);
      toast.error('Failed to finalize note');
    }
  };

  if (isLoadingSession) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Session not found</p>
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
            <h1 className="text-3xl font-bold">Review & Edit Session</h1>
            <p className="text-muted-foreground">
              Patient: {session.patient_name || 'N/A'} | MRN: {session.patient_id || 'N/A'}
            </p>
          </div>
          <Badge variant={status === "finalized" ? "default" : "secondary"} className="text-sm">
            {status === "finalized" ? "Finalized" : "Draft"}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clinical Note</CardTitle>
                    <CardDescription>Edit and finalize the generated documentation</CardDescription>
                  </div>
                  <Select value={detailLevel} onValueChange={setDetailLevel}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="low">Brief</SelectItem>
                      <SelectItem value="medium">Standard</SelectItem>
                      <SelectItem value="high">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[500px] font-mono text-sm"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Transcript Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Original Transcript
                </CardTitle>
                <CardDescription>Reference the original encounter transcript</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">
                    Patient states "I've been having chest pain for the past two days. It's a sharp pain 
                    that comes and goes, and sometimes it goes down my left arm."
                    {"\n\n"}
                    Physician: "When did you first notice the pain? Have you experienced anything like 
                    this before?"
                    {"\n\n"}
                    Patient: "It started on Monday. No, this is the first time. I'm worried it might 
                    be my heart."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* ICD-10 Codes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    <CardTitle>ICD-10 Codes</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleSuggestCodes}
                    disabled={isSuggestingCodes || !noteContent}
                  >
                    {isSuggestingCodes ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <CardDescription>
                  {icdCodes.length > 0 
                    ? 'AI-suggested diagnosis codes' 
                    : 'Click refresh to suggest codes'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {icdCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No codes suggested yet
                  </p>
                ) : (
                  icdCodes.map((code, index) => (
                    <div key={index} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold text-sm">{code.code}</span>
                        {code.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(code.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{code.label || code.description}</p>
                      {code.rationale && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{code.rationale}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Extracted Tasks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    <CardTitle>Extracted Tasks</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleExtractTasks}
                    disabled={isExtractingTasks || !noteContent}
                  >
                    {isExtractingTasks ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <CardDescription>
                  {extractedTasks.length > 0 
                    ? 'AI-extracted follow-up actions' 
                    : 'Click refresh to extract tasks'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {extractedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tasks extracted yet
                  </p>
                ) : (
                  extractedTasks.map((task, index) => (
                    <div key={task.id || index} className="flex items-start gap-2 p-2 rounded-lg border">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                        {task.priority}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Export & Share */}
            {sessionId && <ExportOptions sessionId={sessionId} noteContent={noteContent} />}
            
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handleCopyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </Button>
                
                <Separator className="my-4" />
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleSaveNote}
                  disabled={!noteContent}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button 
                  className="w-full"
                  onClick={handleFinalize}
                  disabled={status === "finalized" || !noteContent}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {status === "finalized" ? "Finalized" : "Finalize Note"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SessionReview;
