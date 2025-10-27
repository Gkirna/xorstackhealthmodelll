import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, User, Stethoscope } from "lucide-react";
import { toast } from "sonner";

interface TranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;
  timestamp_offset?: number;
  created_at: string;
  temp?: boolean;
  pending?: boolean;
}

interface HeidiTranscriptPanelProps {
  transcriptChunks?: TranscriptChunk[];
  transcript?: string;
  onTranscriptChange?: (text: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function HeidiTranscriptPanel({
  transcriptChunks = [],
  transcript = "",
  onTranscriptChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: HeidiTranscriptPanelProps) {
  const handleCopy = () => {
    const textToCopy = transcript || (transcriptChunks?.map(chunk => chunk.text).join('\n') || "");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success("Transcript copied to clipboard");
    }
  };

  // Separate chunks by speaker
  const doctorChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'provider') || [];
  const patientChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'patient') || [];

  // Format chunks for display
  const doctorText = doctorChunks.map(chunk => chunk.text).join('\n\n');
  const patientText = patientChunks.map(chunk => chunk.text).join('\n\n');

  const totalWordCount = (transcript || transcriptChunks?.map(c => c.text).join(' ')).trim().split(/\s+/).filter(Boolean).length;
  const totalCharCount = (transcript || transcriptChunks?.map(c => c.text).join('')).length;

  // If using old transcript prop, show single column
  if (transcriptChunks.length === 0 && transcript) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="text-xs text-muted-foreground">
            {totalWordCount} words · {totalCharCount} characters
          </div>
          <div className="flex gap-1">
            {onUndo && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="text-sm"
                title="Undo (Ctrl+Z)"
              >
                Undo
              </Button>
            )}
            {onRedo && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="text-sm"
                title="Redo (Ctrl+Shift+Z)"
              >
                Redo
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleCopy}
              disabled={!transcript}
              className="text-sm"
            >
              Copy
            </Button>
          </div>
        </div>
        <Textarea
          value={transcript}
          onChange={(e) => onTranscriptChange?.(e.target.value)}
          placeholder="Start recording or type manually..."
          className="flex-1 min-h-[500px] text-sm leading-relaxed resize-none border bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    );
  }

  // Two-column layout for speaker separation
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-muted-foreground">
          {totalWordCount} words · {totalCharCount} characters
        </div>
        <div className="flex gap-1">
          {onUndo && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              className="text-sm"
              title="Undo (Ctrl+Z)"
            >
              Undo
            </Button>
          )}
          {onRedo && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              className="text-sm"
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleCopy}
            disabled={transcriptChunks.length === 0}
            className="text-sm"
          >
            Copy
          </Button>
        </div>
      </div>
      
      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-[500px]">
        {/* Doctor/Provider Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-t border-b border-blue-200">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-blue-700">Doctor</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {doctorChunks.length} chunks
            </span>
          </div>
          <Textarea
            value={doctorText}
            readOnly
            placeholder="Doctor's speech will appear here..."
            className="flex-1 text-sm leading-relaxed resize-none border border-blue-200 bg-blue-50/30 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Patient Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2 p-2 bg-green-50 rounded-t border-b border-green-200">
            <User className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm text-green-700">Patient</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {patientChunks.length} chunks
            </span>
          </div>
          <Textarea
            value={patientText}
            readOnly
            placeholder="Patient's speech will appear here..."
            className="flex-1 text-sm leading-relaxed resize-none border border-green-200 bg-green-50/30 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>
    </div>
  );
}
