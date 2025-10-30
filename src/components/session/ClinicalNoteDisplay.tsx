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
  // Handle arrays as bullet points
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-6 space-y-2 mt-2">
        {value.map((item, idx) => (
          <li key={idx} className="text-base text-foreground leading-relaxed">
            {typeof item === 'string' ? item : renderValue(item, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  // Handle objects with nested content
  if (typeof value === 'object' && value !== null) {
    return (
      <div className={depth > 0 ? "ml-6 mt-3 space-y-3" : "space-y-3"}>
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey}>
            <span className="font-bold text-foreground">
              {formatSectionKey(subKey)}:
            </span>{' '}
            {typeof subValue === 'string' ? (
              <span className="text-base text-foreground leading-relaxed">
                {subValue}
              </span>
            ) : (
              <div className="mt-1">
                {renderValue(subValue, depth + 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Handle strings - check if it contains newlines for paragraph breaks
  const stringValue = String(value);
  if (stringValue.includes('\n')) {
    return (
      <div className="space-y-2">
        {stringValue.split('\n').map((line, idx) => (
          <p key={idx} className="text-base text-foreground leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <p className="text-base text-foreground leading-relaxed">
      {stringValue}
    </p>
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
      <div className="bg-white p-8 rounded-lg space-y-6 print:p-0 print:bg-transparent">
        {Object.entries(noteJson).map(([key, value]) => {
          if (!value) return null;
          
          const label = formatSectionKey(key);
          
          return (
            <div key={key} className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">
                {label}:
              </h3>
              <div className="pl-0">
                {renderValue(value)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  
  // Fallback to plaintext if available
  if (plaintext) {
    return (
      <div className="bg-white p-8 rounded-lg print:p-0 print:bg-transparent">
        <div className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
          {plaintext}
        </div>
      </div>
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
