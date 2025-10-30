import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NoteSection {
  [key: string]: string;
}

interface ClinicalNoteDisplayProps {
  noteJson?: NoteSection | null;
  plaintext?: string;
  templateId?: string;
  templateStructure?: NoteSection;
}

const SECTION_LABELS: Record<string, Record<string, string>> = {
  soap: {
    subjective: 'Subjective',
    objective: 'Objective',
    assessment: 'Assessment',
    plan: 'Plan'
  },
  hpi: {
    hpi: 'History of Present Illness',
    physical_exam: 'Physical Examination',
    assessment: 'Assessment',
    plan: 'Plan'
  },
  progress: {
    interval_history: 'Interval History',
    current_status: 'Current Status',
    assessment: 'Assessment',
    plan: 'Plan'
  },
  discharge: {
    admission_diagnosis: 'Admission Diagnosis',
    hospital_course: 'Hospital Course',
    discharge_diagnosis: 'Discharge Diagnosis',
    discharge_medications: 'Discharge Medications',
    follow_up: 'Follow-up Instructions'
  }
};

const TEMPLATE_LABELS: Record<string, string> = {
  soap: 'SOAP Note',
  hpi: 'HPI + Assessment + Plan',
  progress: 'Progress Note',
  discharge: 'Discharge Summary'
};

export function ClinicalNoteDisplay({ 
  noteJson, 
  plaintext, 
  templateId,
  templateStructure 
}: ClinicalNoteDisplayProps) {
  // If we have structured data, display it formatted
  if (noteJson && typeof noteJson === 'object' && Object.keys(noteJson).length > 0) {
    return (
      <div className="space-y-4">
        {Object.entries(noteJson).map(([key, value]) => {
          if (!value || typeof value !== 'string') return null;
          
          // Get label from template structure or fallback to formatted key
          const label = templateStructure?.[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          return (
            <Card key={key} className="p-5 border border-border/50 bg-card/50">
              <h3 className="text-base font-semibold mb-3 text-foreground border-b border-border/30 pb-2">
                {label}
              </h3>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {value}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
  
  // Fallback to plaintext if available
  if (plaintext) {
    return (
      <Card className="p-6">
        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {plaintext}
        </div>
      </Card>
    );
  }
  
  // No content available
  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground text-center">
        No clinical note generated yet. Start recording to create one.
      </p>
    </Card>
  );
}
