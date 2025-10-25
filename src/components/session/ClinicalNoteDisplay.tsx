import { Card } from "@/components/ui/card";

interface SOAPData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

interface ClinicalNoteDisplayProps {
  noteJson?: SOAPData | null;
  plaintext?: string;
}

export function ClinicalNoteDisplay({ noteJson, plaintext }: ClinicalNoteDisplayProps) {
  // If we have structured SOAP data, display it formatted
  if (noteJson && typeof noteJson === 'object') {
    return (
      <div className="space-y-6">
        {noteJson.subjective && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Subjective</h3>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {noteJson.subjective}
            </p>
          </Card>
        )}
        
        {noteJson.objective && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Objective</h3>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {noteJson.objective}
            </p>
          </Card>
        )}
        
        {noteJson.assessment && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Assessment</h3>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {noteJson.assessment}
            </p>
          </Card>
        )}
        
        {noteJson.plan && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Plan</h3>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {noteJson.plan}
            </p>
          </Card>
        )}
      </div>
    );
  }
  
  // Fallback to plaintext if available
  if (plaintext) {
    return (
      <Card className="p-6">
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono">
          {plaintext}
        </p>
      </Card>
    );
  }
  
  // No content available
  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground text-center">
        No clinical note generated yet. Start a session to create one.
      </p>
    </Card>
  );
}
