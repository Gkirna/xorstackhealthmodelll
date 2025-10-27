import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface TranscriptionStats {
  totalChunks: number;
  savedChunks: number;
  pendingChunks: number;
  failedChunks: number;
  averageLatency: number;
  connectionHealth?: 'healthy' | 'degraded' | 'offline';
  sessionDuration?: number;
}

interface HeidiTranscriptPanelProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  stats?: TranscriptionStats;
  isTranscribing?: boolean;
}

export function HeidiTranscriptPanel({
  transcript,
  onTranscriptChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  stats,
  isTranscribing = false,
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
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            {wordCount} words · {charCount} characters
          </div>
          {isTranscribing && stats && (
            <div className="flex gap-3 flex-wrap text-xs">
              {/* Total & Saved Stats */}
              <div className="flex items-center gap-1.5">
                <span className={`font-medium ${stats.pendingChunks > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                  📊 {stats.totalChunks} total
                </span>
                <span className="text-green-600">
                  ✓ {stats.savedChunks} saved
                </span>
              </div>
              
              {/* Pending with pulse animation */}
              {stats.pendingChunks > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-orange-600 font-medium">
                    ⏳ {stats.pendingChunks} pending
                  </span>
                  <span className="animate-pulse text-orange-500">●</span>
                </div>
              )}
              
              {/* Failed with retry indicator */}
              {stats.failedChunks > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-red-600 font-medium">
                    ❌ {stats.failedChunks} failed
                  </span>
                  <span className="text-xs text-red-500">(retrying...)</span>
                </div>
              )}
              
              {/* Latency - color coded by performance */}
              {stats.averageLatency > 0 && (
                <span className={`font-medium ${
                  stats.averageLatency < 50 ? "text-green-600" :
                  stats.averageLatency < 100 ? "text-yellow-600" :
                  "text-red-600"
                }`}>
                  ⚡ {stats.averageLatency}ms
                  {stats.averageLatency < 50 && " (excellent)"}
                </span>
              )}
              
              {/* Connection health indicator */}
              {stats.connectionHealth && (
                <span className={`font-medium ${
                  stats.connectionHealth === 'healthy' ? 'text-green-600' :
                  stats.connectionHealth === 'degraded' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {stats.connectionHealth === 'healthy' ? '🟢 Online' :
                   stats.connectionHealth === 'degraded' ? '🟡 Degraded' :
                   '🔴 Offline'}
                </span>
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
