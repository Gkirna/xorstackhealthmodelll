import { Card } from "@/components/ui/card";

interface NoteSection {
  [key: string]: string | any;
}

interface ClinicalNoteDisplayProps {
  noteJson?: NoteSection | null;
  plaintext?: string;
  templateId?: string;
  templateStructure?: NoteSection;
}

const formatSectionKey = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const renderValue = (value: any, depth: number = 0): JSX.Element => {
  // Handle arrays
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground/90">
            {typeof item === 'string' ? item : renderValue(item, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  // Handle objects
  if (typeof value === 'object' && value !== null) {
    return (
      <div className={depth > 0 ? "ml-4 mt-2 space-y-2" : "space-y-2"}>
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey}>
            <h5 className="text-sm font-semibold text-foreground/80 mb-1">
              {formatSectionKey(subKey)}:
            </h5>
            <div className="text-sm text-foreground/90 leading-relaxed">
              {renderValue(subValue, depth + 1)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Handle strings and primitives
  return (
    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
      {String(value)}
    </div>
  );
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
          if (!value) return null;
          
          const label = templateStructure?.[key] 
            ? formatSectionKey(key)
            : formatSectionKey(key);
          
          return (
            <Card key={key} className="p-5 border border-border/50 bg-card/50">
              <h3 className="text-base font-semibold mb-3 text-foreground border-b border-border/30 pb-2 uppercase">
                {label}
              </h3>
              {renderValue(value)}
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
