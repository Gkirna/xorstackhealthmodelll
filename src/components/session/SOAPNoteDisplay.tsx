interface SOAPNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

interface SOAPNoteDisplayProps {
  note: SOAPNote | string;
  className?: string;
}

export function SOAPNoteDisplay({ note, className = "" }: SOAPNoteDisplayProps) {
  // Handle if note is a string (JSON string)
  let soapData: SOAPNote;
  
  if (typeof note === 'string') {
    try {
      soapData = JSON.parse(note);
    } catch {
      // If it's not JSON, display as plain text
      return (
        <div className={`space-y-4 ${className}`}>
          <div className="whitespace-pre-wrap text-sm">{note}</div>
        </div>
      );
    }
  } else {
    soapData = note;
  }

  // Check if we have SOAP structured data
  const hasSOAPData = soapData.subjective || soapData.objective || soapData.assessment || soapData.plan;

  if (!hasSOAPData) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="whitespace-pre-wrap text-sm">{JSON.stringify(note, null, 2)}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {soapData.subjective && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Subjective
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {soapData.subjective}
          </p>
        </div>
      )}

      {soapData.objective && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Objective
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {soapData.objective}
          </p>
        </div>
      )}

      {soapData.assessment && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Assessment
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {soapData.assessment}
          </p>
        </div>
      )}

      {soapData.plan && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Plan
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {soapData.plan}
          </p>
        </div>
      )}
    </div>
  );
}
