import { useEffect, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, User, Stethoscope, Activity, Radio } from "lucide-react";
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
  confidence?: number;
}

interface EnhancedTranscriptPanelProps {
  transcriptChunks?: TranscriptChunk[];
  transcript?: string;
  onTranscriptChange?: (text: string) => void;
  isTranscribing?: boolean;
  stats?: {
    doctorChunks: number;
    patientChunks: number;
    totalWords: number;
    totalChars: number;
    duration: number;
  };
  autoScroll?: boolean;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export const EnhancedTranscriptPanel = memo(({
  transcriptChunks = [],
  transcript = "",
  onTranscriptChange,
  isTranscribing = false,
  stats,
  autoScroll = true,
}: EnhancedTranscriptPanelProps) => {
  const doctorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const patientTextareaRef = useRef<HTMLTextAreaElement>(null);
  const doctorScrollTimeRef = useRef(0);
  const patientScrollTimeRef = useRef(0);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (!autoScroll) return;

    const now = Date.now();
    const SCROLL_DEBOUNCE = 50; // Only scroll every 50ms to reduce operations

    // Scroll doctor column
    if (doctorTextareaRef.current && now - doctorScrollTimeRef.current > SCROLL_DEBOUNCE) {
      const textarea = doctorTextareaRef.current;
      textarea.scrollTop = textarea.scrollHeight;
      doctorScrollTimeRef.current = now;
    }

    // Scroll patient column
    if (patientTextareaRef.current && now - patientScrollTimeRef.current > SCROLL_DEBOUNCE) {
      const textarea = patientTextareaRef.current;
      textarea.scrollTop = textarea.scrollHeight;
      patientScrollTimeRef.current = now;
    }
  }, [transcriptChunks, autoScroll]);

  const handleCopy = () => {
    const textToCopy = transcript || (transcriptChunks?.map(chunk => chunk.text).join('\n') || "");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success("Transcript copied to clipboard");
    }
  };

  // Separate chunks by speaker with memoization
  const doctorChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'provider') || [];
  const patientChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'patient') || [];

  const doctorText = doctorChunks.map(chunk => chunk.text).join('\n\n');
  const patientText = patientChunks.map(chunk => chunk.text).join('\n\n');

  const totalWordCount = (transcript || transcriptChunks?.map(c => c.text).join(' ')).trim().split(/\s+/).filter(Boolean).length;
  const totalCharCount = (transcript || transcriptChunks?.map(c => c.text).join('')).length;

  // Show single column if using old transcript prop
  if (transcriptChunks.length === 0 && transcript) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="text-xs text-muted-foreground">
            {totalWordCount} words · {totalCharCount} characters
          </div>
          <div className="flex gap-1">
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

  // Two-column layout with enhanced features
  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Stats Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold">{totalWordCount}</span> words
          </div>
          <div>
            <span className="font-semibold">{totalCharCount}</span> characters
          </div>
          {stats && (
            <>
              <div>
                <span className="font-semibold">{formatDuration(stats.duration)}</span>
              </div>
              {isTranscribing && (
                <div className="flex items-center gap-1 text-green-600 animate-pulse">
                  <Activity className="h-3 w-3" />
                  <span className="font-semibold">Live</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleCopy}
            disabled={transcriptChunks.length === 0}
            className="text-sm"
            title="Copy full transcript"
          >
            Copy
          </Button>
        </div>
      </div>
      
      {/* Two-column layout with enhanced visuals */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-[500px]">
        {/* Doctor/Provider Column */}
        <div className="flex flex-col border rounded-lg overflow-hidden">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between p-3 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-blue-700">Doctor</h3>
              {isTranscribing && transcriptChunks.length > 0 && transcriptChunks[transcriptChunks.length - 1]?.speaker === 'provider' && (
                <Radio className="h-3 w-3 text-blue-600 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {doctorChunks.length} {doctorChunks.length === 1 ? 'chunk' : 'chunks'}
              </span>
              {doctorChunks.some(c => c.pending) && (
                <span className="text-xs text-blue-500 animate-pulse">Saving...</span>
              )}
            </div>
          </div>
          
          {/* Textarea with auto-scroll */}
          <Textarea
            ref={doctorTextareaRef}
            value={doctorText}
            readOnly
            placeholder="Doctor's speech will appear here..."
            className="flex-1 min-h-[400px] text-sm leading-relaxed resize-none border-0 bg-blue-50/30 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto"
            style={{ scrollBehavior: 'smooth' }}
          />
        </div>

        {/* Patient Column */}
        <div className="flex flex-col border rounded-lg overflow-hidden">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between p-3 bg-green-50 border-b border-green-200">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-sm text-green-700">Patient</h3>
              {isTranscribing && transcriptChunks.length > 0 && transcriptChunks[transcriptChunks.length - 1]?.speaker === 'patient' && (
                <Radio className="h-3 w-3 text-green-600 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {patientChunks.length} {patientChunks.length === 1 ? 'chunk' : 'chunks'}
              </span>
              {patientChunks.some(c => c.pending) && (
                <span className="text-xs text-green-500 animate-pulse">Saving...</span>
              )}
            </div>
          </div>
          
          {/* Textarea with auto-scroll */}
          <Textarea
            ref={patientTextareaRef}
            value={patientText}
            readOnly
            placeholder="Patient's speech will appear here..."
            className="flex-1 min-h-[400px] text-sm leading-relaxed resize-none border-0 bg-green-50/30 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto"
            style={{ scrollBehavior: 'smooth' }}
          />
        </div>
      </div>
      
      {/* Optional: Footer with additional info */}
      {transcriptChunks.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {transcriptChunks.filter(c => c.pending).length > 0 && (
            <span className="text-yellow-600">
              {transcriptChunks.filter(c => c.pending).length} {transcriptChunks.filter(c => c.pending).length === 1 ? 'chunk' : 'chunks'} pending save...
            </span>
          )}
        </div>
      )}
    </div>
  );
});

EnhancedTranscriptPanel.displayName = 'EnhancedTranscriptPanel';

