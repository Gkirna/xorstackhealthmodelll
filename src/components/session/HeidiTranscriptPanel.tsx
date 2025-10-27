import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface HeidiTranscriptPanelProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  saveStatus?: 'saving' | 'saved' | 'error' | null;
}

export function HeidiTranscriptPanel({
  transcript,
  onTranscriptChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  saveStatus = null,
}: HeidiTranscriptPanelProps) {
  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      toast.success("Transcript copied to clipboard");
    }
  };

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const charCount = transcript.length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {wordCount} words · {charCount} characters
          </div>
          {saveStatus && (
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-blue-500">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-success">Saved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">Save failed</span>
                </>
              )}
            </div>
          )}
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
        onChange={(e) => onTranscriptChange(e.target.value)}
        placeholder="Start recording or type manually..."
        className="flex-1 min-h-[500px] text-sm leading-relaxed resize-none border bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
