import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface HeidiTranscriptPanelProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
}

export function HeidiTranscriptPanel({
  transcript,
  onTranscriptChange,
}: HeidiTranscriptPanelProps) {
  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      toast.success("Transcript copied to clipboard");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end mb-4">
        <Button 
          variant="ghost" 
          onClick={handleCopy}
          disabled={!transcript}
          className="text-sm"
        >
          Copy
        </Button>
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
