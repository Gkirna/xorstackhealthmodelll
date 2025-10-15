import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PatientContextCardProps {
  patientName?: string;
  patientId?: string;
  chiefComplaint?: string;
  onUpdate?: (field: string, value: string) => void;
}

export function PatientContextCard({ 
  patientName = "", 
  patientId = "", 
  chiefComplaint = "",
  onUpdate 
}: PatientContextCardProps) {
  return (
    <Card className="w-[280px] p-4 space-y-4 border-border rounded-2xl">
      <h3 className="font-semibold text-base text-foreground">Patient Context</h3>
      
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="patient-name" className="text-xs text-muted-foreground">
            Patient Name
          </Label>
          <Input
            id="patient-name"
            placeholder="Enter patient name"
            value={patientName}
            onChange={(e) => onUpdate?.("patientName", e.target.value)}
            className="h-10 text-sm rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="patient-id" className="text-xs text-muted-foreground">
            Patient ID / MRN
          </Label>
          <Input
            id="patient-id"
            placeholder="Enter patient ID"
            value={patientId}
            onChange={(e) => onUpdate?.("patientId", e.target.value)}
            className="h-10 text-sm rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chief-complaint" className="text-xs text-muted-foreground">
            Chief Complaint
          </Label>
          <Textarea
            id="chief-complaint"
            placeholder="Brief description of complaint"
            value={chiefComplaint}
            onChange={(e) => onUpdate?.("chiefComplaint", e.target.value)}
            className="min-h-[80px] text-sm rounded-xl resize-none"
          />
        </div>
      </div>
    </Card>
  );
}
