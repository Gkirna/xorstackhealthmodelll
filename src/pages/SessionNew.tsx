import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const SessionNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  
  const [formData, setFormData] = useState({
    patientName: "",
    patientId: "",
    dob: "",
    chiefComplaint: "",
    appointmentType: "",
    visitMode: "in-person",
    inputLanguage: "en",
    outputLanguage: "en",
    consentGiven: false,
    templateId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.consentGiven) {
      toast.error("Patient consent is required to proceed");
      return;
    }

    setLoading(true);
    
    // Placeholder for Supabase session creation
    setTimeout(() => {
      const newSessionId = "temp-session-id-123";
      toast.success("Session created successfully!");
      navigate(`/session/${newSessionId}/record`);
      setLoading(false);
    }, 1500);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Session</h1>
          <p className="text-muted-foreground">Create a new clinical encounter session</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Patient Information</CardTitle>
              <CardDescription>Enter patient details for this encounter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name *</Label>
                  <Input
                    id="patientName"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={formData.patientName}
                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patientId">Patient ID / MRN *</Label>
                  <Input
                    id="patientId"
                    type="text"
                    placeholder="MRN-123456"
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Date/Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chiefComplaint">Chief Complaint / Reason for Visit</Label>
                <Textarea
                  id="chiefComplaint"
                  placeholder="e.g., Chest pain, Annual checkup, Follow-up for hypertension"
                  rows={3}
                  value={formData.chiefComplaint}
                  onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="appointmentType">Appointment Type</Label>
                  <Select 
                    value={formData.appointmentType} 
                    onValueChange={(value) => setFormData({ ...formData, appointmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="initial">Initial Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up Visit</SelectItem>
                      <SelectItem value="annual">Annual Checkup</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitMode">Visit Mode</Label>
                  <Select 
                    value={formData.visitMode} 
                    onValueChange={(value) => setFormData({ ...formData, visitMode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="in-person">In-Person</SelectItem>
                      <SelectItem value="telemedicine">Telemedicine</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="inputLanguage">Input Language</Label>
                  <Select 
                    value={formData.inputLanguage} 
                    onValueChange={(value) => setFormData({ ...formData, inputLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outputLanguage">Output Language</Label>
                  <Select 
                    value={formData.outputLanguage} 
                    onValueChange={(value) => setFormData({ ...formData, outputLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId">Template (Optional)</Label>
                <Select 
                  value={formData.templateId} 
                  onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use default template" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="soap">SOAP Note</SelectItem>
                    <SelectItem value="hp">History & Physical</SelectItem>
                    <SelectItem value="progress">Progress Note</SelectItem>
                    <SelectItem value="consult">Consultation Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="consent" className="text-base">Patient Consent</Label>
                  <p className="text-sm text-muted-foreground">
                    Patient has consented to AI-assisted documentation
                  </p>
                </div>
                <Switch
                  id="consent"
                  checked={formData.consentGiven}
                  onCheckedChange={(checked) => setFormData({ ...formData, consentGiven: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating session..." : "Start Recording"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default SessionNew;
