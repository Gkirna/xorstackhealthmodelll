import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SOAPNoteDisplay } from "./SOAPNoteDisplay";
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
  noteJson?: any;
  onNoteChange: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  sessionId?: string;
  selectedTemplate?: "soap" | "progress" | "discharge" | "goldilocks";
  onTemplateChange?: (value: "soap" | "progress" | "discharge" | "goldilocks") => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function HeidiNotePanel({ note, noteJson, onNoteChange, onGenerate, isGenerating, sessionId, selectedTemplate: selectedTemplateProp, onTemplateChange, onUndo, onRedo, canUndo = false, canRedo = false }: HeidiNotePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<"soap" | "progress" | "discharge" | "goldilocks">(selectedTemplateProp || "goldilocks");
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");

  const handleCopy = () => {
    navigator.clipboard.writeText(note);
    toast.success("Note copied to clipboard");
  };

  const handleExport = () => {
    toast.info("Exporting note...");
  };

  const handleClear = () => {
    onNoteChange("");
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([note || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "clinical-note.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const handlePrint = () => {
    const printable = window.open("", "_blank");
    if (!printable) return;
    printable.document.write(
      `<!doctype html><html><head><title>Clinical Note</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;white-space:pre-wrap;margin:2rem;}</style></head><body>${escapeHtml(
        note || ""
      )}</body></html>`
    );
    printable.document.close();
    printable.focus();
    printable.print();
    printable.close();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Template Selector */}
          <Select value={selectedTemplate} onValueChange={(v: "soap" | "progress" | "discharge" | "goldilocks") => { setSelectedTemplate(v); onTemplateChange && onTemplateChange(v); }}>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleCopy}>
                Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTxt}>
                Download .txt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSpellcheckEnabled((v) => !v)}>
                {spellcheckEnabled ? "Disable Spellcheck" : "Enable Spellcheck"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClear}>
                Clear note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerate} disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate note"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Mic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border" />
          {onUndo && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </Button>
          )}
          {onRedo && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </Button>
          )}
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

      {/* Note Display/Editor */}
      {viewMode === "formatted" && noteJson ? (
        <div className="flex-1 min-h-[500px] p-6 border rounded-lg bg-card overflow-auto">
          <SOAPNoteDisplay note={noteJson} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          spellCheck={spellcheckEnabled}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Your clinical note will appear here after generation..."
          className="flex-1 min-h-[500px] text-sm resize-none border bg-card focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      )}
    </div>
  );
}



