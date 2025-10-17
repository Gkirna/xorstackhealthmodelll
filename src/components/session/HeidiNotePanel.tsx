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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Template Selector */}
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-auto h-8 border-0 bg-transparent hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="text-sm">📋</span>
                <span className="text-sm">Select a template</span>
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
          <Button variant="outline" size="sm" className="h-8">
            <span className="text-sm">✏️ {selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)}</span>
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Mic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronDown className="h-4 w-4" />
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
              <Button variant="ghost" className="h-8">
                <span className="text-sm">Copy</span>
                <ChevronDown className="ml-1 h-3 w-3" />
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

      {/* Note Editor */}
      <Textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Your clinical note will appear here after generation..."
        className="flex-1 min-h-[500px] text-sm resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
