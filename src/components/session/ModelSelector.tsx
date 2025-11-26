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
      <SelectTrigger className="w-[300px] bg-[#D4A574] text-gray-900 border-[#C4956A] hover:bg-[#C4956A] font-medium shadow-sm">
        <SelectValue placeholder="Select transcription model" />
      </SelectTrigger>
      <SelectContent className="max-h-[450px] bg-[#D4A574] border-[#C4956A] z-50">
        <SelectGroup>
          <SelectLabel className="text-gray-900 font-semibold px-2 py-1.5">OpenAI (Whisper)</SelectLabel>
          <SelectItem value="whisper-1" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            whisper-1
          </SelectItem>
          <SelectItem value="gpt-4o-mini-transcribe" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            gpt-4o-mini-transcribe
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="text-gray-900 font-semibold px-2 py-1.5">AssemblyAI Real-Time</SelectLabel>
          <SelectItem value="assemblyai-best" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            assemblyai-best (highest accuracy)
          </SelectItem>
          <SelectItem value="assemblyai-nano" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            assemblyai-nano (fastest)
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="text-gray-900 font-semibold px-2 py-1.5">Deepgram Models</SelectLabel>
          <SelectItem value="nova-2" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            nova-2
          </SelectItem>
          <SelectItem value="nova-2-general" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            nova-2-general
          </SelectItem>
          <SelectItem value="nova-2-conversational" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            nova-2-conversational
          </SelectItem>
          <SelectItem value="nova-2-medical" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            nova-2-medical ⭐
          </SelectItem>
          <SelectItem value="nova-2-phonecall" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            nova-2-phonecall
          </SelectItem>
          <SelectItem value="enhanced" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            enhanced
          </SelectItem>
          <SelectItem value="whisper-large" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            whisper-large
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="text-gray-900 font-semibold px-2 py-1.5">Silero VAD (Voice Detection)</SelectLabel>
          <SelectItem value="silero-vad-1" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            silero-vad-1
          </SelectItem>
          <SelectItem value="silero-vad-2" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            silero-vad-2
          </SelectItem>
        </SelectGroup>
        
        <SelectGroup>
          <SelectLabel className="text-gray-900 font-semibold px-2 py-1.5">Turn Detector (Conversation)</SelectLabel>
          <SelectItem value="turn_detector_v1" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            turn_detector_v1
          </SelectItem>
          <SelectItem value="turn_detector_v2" className="text-gray-900 hover:bg-[#C4956A] focus:bg-[#C4956A]">
            turn_detector_v2
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
