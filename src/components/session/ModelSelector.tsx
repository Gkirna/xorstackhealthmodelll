import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export const ModelSelector = ({ value, onValueChange }: ModelSelectorProps) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[300px] bg-amber-700 text-white border-amber-800 hover:bg-amber-800 font-medium shadow-sm">
        <SelectValue placeholder="Select transcription model" />
      </SelectTrigger>
      <SelectContent className="max-h-[450px] bg-background border-border z-50">
        <SelectGroup>
          <SelectLabel className="font-semibold px-2 py-1.5">OpenAI (Whisper)</SelectLabel>
          <SelectItem value="whisper-1">
            whisper-1
          </SelectItem>
          <SelectItem value="gpt-4o-mini-transcribe">
            gpt-4o-mini-transcribe
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="font-semibold px-2 py-1.5">AssemblyAI Real-Time</SelectLabel>
          <SelectItem value="assemblyai-best">
            assemblyai-best (highest accuracy)
          </SelectItem>
          <SelectItem value="assemblyai-nano">
            assemblyai-nano (fastest)
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="font-semibold px-2 py-1.5">Deepgram Models</SelectLabel>
          <SelectItem value="nova-2">
            nova-2
          </SelectItem>
          <SelectItem value="nova-2-general">
            nova-2-general
          </SelectItem>
          <SelectItem value="nova-2-conversational">
            nova-2-conversational
          </SelectItem>
          <SelectItem value="nova-2-medical">
            nova-2-medical ⭐
          </SelectItem>
          <SelectItem value="nova-2-phonecall">
            nova-2-phonecall
          </SelectItem>
          <SelectItem value="enhanced">
            enhanced
          </SelectItem>
          <SelectItem value="whisper-large">
            whisper-large
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="font-semibold px-2 py-1.5">Silero VAD (Voice Detection)</SelectLabel>
          <SelectItem value="silero-vad-1">
            silero-vad-1
          </SelectItem>
          <SelectItem value="silero-vad-2">
            silero-vad-2
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="font-semibold px-2 py-1.5">Turn Detector (Conversation)</SelectLabel>
          <SelectItem value="turn_detector_v1">
            turn_detector_v1
          </SelectItem>
          <SelectItem value="turn_detector_v2">
            turn_detector_v2
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
