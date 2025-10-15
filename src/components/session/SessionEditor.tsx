import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SessionEditorProps {
  transcript?: string;
  generatedNote?: string;
  onTranscriptChange?: (value: string) => void;
}

export function SessionEditor({ 
  transcript = "", 
  generatedNote = "",
  onTranscriptChange 
}: SessionEditorProps) {
  const [activeTab, setActiveTab] = useState("note");
  const [granular, setGranular] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex-1 space-y-4">
      {/* Prompt Input */}
      <Card className="p-4 rounded-3xl border-border">
        <div className="flex gap-3">
          <Input
            placeholder="Describe what you want to generate..."
            className="flex-1 h-12 rounded-3xl border-input focus:border-primary text-base"
          />
          <Button 
            size="lg" 
            className="h-12 px-8 rounded-3xl bg-primary hover:bg-primary-hover shadow-button transition-all hover:scale-105"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Generate
          </Button>
        </div>
      </Card>

      {/* Template & Granularity Controls */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="w-[240px] h-11 rounded-xl border-border">
            <SelectValue placeholder="Select template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soap">SOAP Note</SelectItem>
            <SelectItem value="progress">Progress Note</SelectItem>
            <SelectItem value="hp">H&P Template</SelectItem>
            <SelectItem value="mental">Mental Health Assessment</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-3">
          <Label htmlFor="granular-mode" className="text-sm text-muted-foreground cursor-pointer">
            Detailed Mode
          </Label>
          <Switch
            id="granular-mode"
            checked={granular}
            onCheckedChange={setGranular}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 rounded-xl p-1">
          <TabsTrigger 
            value="note" 
            className={cn(
              "rounded-lg text-sm font-medium transition-all",
              activeTab === "note" && "bg-background shadow-sm"
            )}
          >
            <FileText className="h-4 w-4 mr-2" />
            Note
          </TabsTrigger>
          <TabsTrigger 
            value="context"
            className={cn(
              "rounded-lg text-sm font-medium transition-all",
              activeTab === "context" && "bg-background shadow-sm"
            )}
          >
            Context
          </TabsTrigger>
          <TabsTrigger 
            value="transcript"
            className={cn(
              "rounded-lg text-sm font-medium transition-all",
              activeTab === "transcript" && "bg-background shadow-sm"
            )}
          >
            Transcript
          </TabsTrigger>
        </TabsList>

        <TabsContent value="note" className="mt-4">
          <Card className="p-6 rounded-2xl border-border min-h-[500px] relative">
            {generatedNote ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-primary/10"
                  onClick={() => handleCopy(generatedNote)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                  {generatedNote}
                </pre>
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                  <p className="text-muted-foreground">No note generated yet</p>
                  <p className="text-sm text-muted-foreground">Click Generate to create your clinical note</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="context" className="mt-4">
          <Card className="p-6 rounded-2xl border-border min-h-[500px]">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Session Context</h3>
              <p className="text-sm text-muted-foreground">
                Additional context and metadata will appear here
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="mt-4">
          <Card className="p-6 rounded-2xl border-border min-h-[500px] relative">
            {transcript ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-primary/10"
                  onClick={() => handleCopy(transcript)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Textarea
                  value={transcript}
                  onChange={(e) => onTranscriptChange?.(e.target.value)}
                  className="min-h-[450px] border-0 p-0 font-mono text-sm resize-none focus-visible:ring-0"
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">No transcript available</p>
                  <p className="text-sm text-muted-foreground">Start recording to see transcript</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
