import { useState } from "react";
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
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SessionReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [noteContent, setNoteContent] = useState(`SUBJECTIVE:
Patient presents with chief complaint of chest pain. Patient reports symptoms began approximately 2 days ago. Pain is described as sharp, intermittent, and radiating to the left arm. Denies shortness of breath, palpitations, or diaphoresis. No recent trauma or injury.

OBJECTIVE:
Vital Signs:
- Blood Pressure: 120/80 mmHg
- Heart Rate: 72 bpm
- Temperature: 98.6°F
- Respiratory Rate: 16 breaths/min
- Oxygen Saturation: 98% on room air

Physical Examination:
- General: Alert and oriented x3, no acute distress
- Cardiovascular: Regular rate and rhythm, no murmurs
- Respiratory: Clear to auscultation bilaterally
- Chest wall: No tenderness to palpation

ASSESSMENT:
1. Chest pain - likely musculoskeletal in origin vs. early cardiac pathology
2. No immediate signs of acute coronary syndrome

PLAN:
1. Order EKG and cardiac enzyme panel (troponin, CK-MB)
2. Start aspirin 325mg orally if cardiac enzymes elevated
3. Prescribe ibuprofen 400mg TID for musculoskeletal pain
4. Follow up in 48 hours or sooner if symptoms worsen
5. Patient education provided regarding cardiac warning signs
6. Return precautions discussed`);

  const [detailLevel, setDetailLevel] = useState("medium");
  const [status, setStatus] = useState("draft");

  const icdCodes = [
    { code: "R07.9", description: "Chest pain, unspecified" },
    { code: "M79.1", description: "Myalgia" },
    { code: "Z13.6", description: "Encounter for screening for cardiovascular disorders" }
  ];

  const extractedTasks = [
    { title: "Order EKG", priority: "high", dueDate: "2025-10-10" },
    { title: "Order cardiac enzyme panel", priority: "high", dueDate: "2025-10-10" },
    { title: "Follow-up appointment", priority: "medium", dueDate: "2025-10-12" }
  ];

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(noteContent);
    toast.success("Note copied to clipboard!");
  };

  const handleExportPDF = () => {
    toast.success("PDF export initiated!");
  };

  const handleEmail = () => {
    toast.success("Email sent!");
  };

  const handleFinalize = () => {
    setStatus("finalized");
    toast.success("Note finalized and saved!");
    setTimeout(() => navigate("/sessions"), 1500);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Review & Edit Session</h1>
            <p className="text-muted-foreground">Patient: John Doe | MRN: MRN-123456</p>
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
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  ICD-10 Codes
                </CardTitle>
                <CardDescription>Suggested diagnosis codes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {icdCodes.map((code, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-sm">{code.code}</span>
                      <Button variant="ghost" size="sm">Add</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{code.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Extracted Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Extracted Tasks
                </CardTitle>
                <CardDescription>Follow-up actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {extractedTasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded-lg border">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">Due: {task.dueDate}</p>
                    </div>
                    <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

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
                <Button variant="outline" className="w-full justify-start" onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Note
                </Button>
                
                <Separator className="my-4" />
                
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
                  onClick={handleFinalize}
                  disabled={status === "finalized"}
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
