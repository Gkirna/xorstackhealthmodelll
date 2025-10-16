import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface HeidiTranscriptPanelProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
}

export function HeidiTranscriptPanel({
  transcript,
  onTranscriptChange,
}: HeidiTranscriptPanelProps) {

  return (
    <div className="space-y-6">
      {/* Transcript Display Only */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">Live Transcript</h3>
            {transcript && (
              <span className="text-[12px] text-muted-foreground">
                {transcript.split(" ").length} words
              </span>
            )}
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder="Start recording or type manually..."
            className="min-h-[300px] text-[16px] leading-relaxed resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </Card>
    </div>
  );
}
