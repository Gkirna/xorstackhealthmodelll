import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Mic, Undo, Redo, ChevronDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ClinicalNoteDisplay } from "./ClinicalNoteDisplay";
import { TemplateSelector } from "./TemplateSelector";
import { useTemplates } from "@/hooks/useTemplates";
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
  selectedTemplate?: string;
  onTemplateChange?: (value: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  noteJson?: any;
  showFormatted?: boolean;
  onToggleFormatted?: () => void;
}

export function HeidiNotePanel({ 
  note, 
  onNoteChange, 
  onGenerate, 
  isGenerating, 
  sessionId, 
  selectedTemplate: selectedTemplateProp, 
  onTemplateChange, 
  onUndo, 
  onRedo, 
  canUndo = false, 
  canRedo = false,
  noteJson,
  showFormatted = true,
  onToggleFormatted 
}: HeidiNotePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: templates } = useTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<string>(selectedTemplateProp || "");
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);

  const currentTemplate = templates?.find(t => t.id === selectedTemplate);

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
    // Use plaintext if available, otherwise format the JSON
    let content = note;
    if (!content && noteJson) {
      content = formatNoteForExport(noteJson);
    }
    const blob = new Blob([content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "clinical-note.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const formatNoteForExport = (json: any): string => {
    let formatted = '';
    
    // Handle the case where JSON has a 'sections' property
    const sections = json.sections || json;
    
    Object.entries(sections).forEach(([key, value]) => {
      if (key === 'template_id' || key === 'plaintext') return;
      const sectionTitle = formatSectionKey(key);
      formatted += `${sectionTitle.toUpperCase()}:\n\n`;
      formatted += formatValue(value) + '\n\n';
    });
    return formatted;
  };

  const formatSectionKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: any, indent: string = ''): string => {
    if (Array.isArray(value)) {
      return value.map(item => `${indent}• ${formatValue(item, indent + '  ')}`).join('\n');
    }
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value)
        .map(([k, v]) => {
          const label = formatSectionKey(k);
          const formattedVal = formatValue(v, indent + '  ');
          return `${indent}${label}: ${formattedVal}`;
        })
        .join('\n');
    }
    return String(value);
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
    
    // Format the note for printing
    let htmlContent = '';
    if (noteJson) {
      htmlContent = formatNoteForPrint(noteJson);
    } else if (note) {
      htmlContent = `<div style="white-space: pre-wrap;">${escapeHtml(note)}</div>`;
    }
    
    printable.document.write(
      `<!doctype html>
      <html>
        <head>
          <title>Clinical Note</title>
          <style>
            @media print {
              @page { margin: 1in; }
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              line-height: 1.6;
              color: #000;
              margin: 0;
              padding: 20px;
            }
            h3 {
              font-size: 16px;
              font-weight: bold;
              margin: 20px 0 10px 0;
            }
            p {
              margin: 8px 0;
              font-size: 14px;
            }
            ul {
              margin: 8px 0;
              padding-left: 24px;
            }
            li {
              margin: 6px 0;
              font-size: 14px;
            }
            .section {
              margin-bottom: 20px;
            }
            .subsection {
              margin-left: 0;
            }
            .subsection-title {
              font-weight: bold;
              display: inline;
            }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>`
    );
    printable.document.close();
    printable.focus();
    printable.print();
    printable.close();
  };

  const formatNoteForPrint = (json: any): string => {
    let html = '';
    
    // Handle the case where JSON has a 'sections' property
    const sections = json.sections || json;
    
    Object.entries(sections).forEach(([key, value]) => {
      if (key === 'template_id' || key === 'plaintext') return;
      const sectionTitle = formatSectionKey(key);
      html += `<div class="section"><h3>${sectionTitle.toUpperCase()}:</h3>`;
      html += formatValueToPrintHtml(value);
      html += '</div>';
    });
    return html;
  };

  const formatValueToPrintHtml = (value: any): string => {
    if (Array.isArray(value)) {
      return '<ul>' + value.map(item => 
        `<li>${typeof item === 'string' ? escapeHtml(item) : formatValueToPrintHtml(item)}</li>`
      ).join('') + '</ul>';
    }
    if (typeof value === 'object' && value !== null) {
      return '<div class="subsection">' + Object.entries(value).map(([k, v]) => {
        const label = formatSectionKey(k);
        if (typeof v === 'string') {
          return `<p><span class="subsection-title">${label}:</span> ${escapeHtml(v)}</p>`;
        }
        return `<div><span class="subsection-title">${label}:</span>${formatValueToPrintHtml(v)}</div>`;
      }).join('') + '</div>';
    }
    return `<p>${escapeHtml(String(value))}</p>`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Template Selector */}
          <div className="flex-1">
            <TemplateSelector 
              value={selectedTemplate} 
              onChange={(v) => { 
                setSelectedTemplate(v); 
                onTemplateChange && onTemplateChange(v); 
              }} 
            />
          </div>

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
              {onToggleFormatted && (
                <DropdownMenuItem onClick={onToggleFormatted}>
                  {showFormatted ? "Show Raw Text" : "Show Formatted"}
                </DropdownMenuItem>
              )}
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

      {/* Note Display */}
      <div className="flex-1 overflow-auto bg-background">
        {showFormatted && noteJson ? (
          <ClinicalNoteDisplay 
            noteJson={noteJson} 
            plaintext={note}
            templateId={selectedTemplate}
            templateStructure={currentTemplate?.structure}
          />
        ) : (
          <div className="bg-white p-8 rounded-lg">
            <Textarea
              ref={textareaRef}
              spellCheck={spellcheckEnabled}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Your clinical note will appear here after generation..."
              className="w-full min-h-[500px] text-base resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}



