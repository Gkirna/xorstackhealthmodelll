import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Mic, Undo, Redo, ChevronDown, MoreHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeidiNotePanelProps {
  note: string;
  onNoteChange: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  sessionId?: string;
}

export function HeidiNotePanel({ note, onNoteChange, onGenerate, isGenerating, sessionId }: HeidiNotePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("goldilocks");

  const handleCopy = () => {
    navigator.clipboard.writeText(note);
    toast.success("Note copied to clipboard");
  };

  const handleExport = () => {
    toast.info("Exporting note...");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          {/* Template Selector */}
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-48 h-9">
              <div className="flex items-center gap-2">
                <span className="text-sm">📋</span>
                <SelectValue placeholder="Select a template" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="goldilocks">Goldilocks</SelectItem>
              <SelectItem value="soap">SOAP Note</SelectItem>
              <SelectItem value="progress">Progress Note</SelectItem>
              <SelectItem value="discharge">Discharge Summary</SelectItem>
            </SelectContent>
          </Select>

          {/* Template Name Display */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            <span className="text-sm font-medium">{selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)}</span>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Mic className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Redo className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 gap-1">
                <span className="text-sm">Copy</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Note Editor or Empty State */}
      {!note ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="mb-8">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              className="mx-auto mb-4"
            >
              <path
                d="M40 80 Q50 50, 70 40 T100 20"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted-foreground"
                strokeLinecap="round"
              />
              <circle cx="105" cy="15" r="3" fill="currentColor" className="text-muted-foreground" />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">Start this session using the header</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            Your note will appear here once your session is complete
          </p>

          <div className="bg-muted/30 rounded-lg p-6 max-w-sm">
            <div className="mb-4">
              <Button className="bg-green-600 hover:bg-green-700 text-white mb-3 w-full">
                <Mic className="mr-2 h-4 w-4" />
                Start transcribing
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              <div className="bg-background rounded-md border p-2 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 hover:bg-accent rounded text-sm">
                  <span>Transcribing</span>
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div className="px-2 py-1 hover:bg-accent rounded text-sm text-muted-foreground">
                  Dictating
                </div>
                <div className="px-2 py-1 hover:bg-accent rounded text-sm text-muted-foreground">
                  Upload session audio
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Select your visit mode in the dropdown
            </p>
          </div>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Your clinical note will appear here after generation..."
          className="flex-1 min-h-[400px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
        />
      )}
    </div>
  );
}
