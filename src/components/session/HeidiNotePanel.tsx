import { useState } from "react";
import { Copy, Download, Mail, Send, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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

const templates = [
  { id: "hp", label: "H&P", color: "bg-primary" },
  { id: "goldilocks", label: "Goldilocks", color: "bg-accent" },
  { id: "brief", label: "Brief", color: "bg-secondary" },
  { id: "soap", label: "SOAP", color: "bg-success" },
  { id: "progress", label: "Progress", color: "bg-muted-foreground" },
];

export function HeidiNotePanel({
  note,
  onNoteChange,
  onGenerate,
  isGenerating,
  sessionId,
}: HeidiNotePanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("goldilocks");
  const [detailLevel, setDetailLevel] = useState([50]);
  const [askAiQuery, setAskAiQuery] = useState("");

  const handleCopy = () => {
    navigator.clipboard.writeText(note);
    toast.success("Note copied to clipboard");
  };

  const handleExport = (format: string) => {
    toast.info(`Exporting as ${format}...`);
  };

  return (
    <div className="space-y-4">
      {/* Template Selection */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-4">
          <h3 className="text-[16px] font-semibold">Note Template</h3>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant={selectedTemplate === template.id ? "default" : "outline"}
                size="sm"
                className={`rounded-full px-4 ${
                  selectedTemplate === template.id ? template.color : ""
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                {template.label}
              </Button>
            ))}
          </div>

          {/* Goldilocks Slider */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[14px] font-medium">Detail Level</label>
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-accent to-primary text-background"
              >
                {detailLevel[0]}%
              </Badge>
            </div>
            <Slider
              value={detailLevel}
              onValueChange={setDetailLevel}
              max={100}
              step={1}
              className="[&>span]:bg-gradient-to-r [&>span]:from-accent [&>span]:to-primary"
            />
            <div className="flex justify-between text-[12px] text-muted-foreground">
              <span>Brief</span>
              <span>Comprehensive</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Note Editor */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">Generated Note</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopy}
                disabled={!note}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={!note}>
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={() => handleExport("PDF")}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("Email")}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="min-h-[260px] max-h-[400px] overflow-y-auto">
            {note ? (
              <Textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                className="min-h-[260px] text-[16px] leading-relaxed resize-none border-0 focus-visible:ring-0"
              />
            ) : (
              <div className="min-h-[260px] flex items-center justify-center text-center text-muted-foreground">
                <div className="space-y-2">
                  <Sparkles className="h-12 w-12 mx-auto opacity-20" />
                  <p className="text-[14px]">No note generated yet</p>
                  <p className="text-[12px]">Add transcript and click Generate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Ask AI Bar */}
      <Card className="p-4 rounded-3xl border-2 border-primary/20">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Mic className="h-4 w-4" />
          </Button>
          <Input
            value={askAiQuery}
            onChange={(e) => setAskAiQuery(e.target.value)}
            placeholder="Ask AI to summarize, expand, or modify this note..."
            className="border-0 focus-visible:ring-0 text-[14px] bg-transparent"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full bg-primary hover:bg-primary-hover"
            disabled={!askAiQuery.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Generate Button */}
      {!note && (
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full h-12 rounded-full text-[16px] font-semibold"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Sparkles className="mr-2 h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Clinical Note
            </>
          )}
        </Button>
      )}
    </div>
  );
}
