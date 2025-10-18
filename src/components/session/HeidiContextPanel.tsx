import { useState, useRef } from "react";
import { FileText, Loader2, Mic, ChevronDown, Undo, Redo, Paperclip, ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeidiContextPanelProps {
  context: string;
  onContextChange: (text: string) => void;
  sessionId?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

interface UploadedFile {
  name: string;
  size: number;
  url: string;
}

export function HeidiContextPanel({
  context,
  onContextChange,
  sessionId,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: HeidiContextPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File) => {
    if (!sessionId) {
      toast.error("No session ID available for file upload");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${sessionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("audio-recordings")
        .getPublicUrl(fileName);

      setUploadedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          url: publicUrl,
        },
      ]);

      toast.success(`${file.name} uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      await uploadFile(file);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="hidden sm:flex justify-end mb-4 gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Mic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ChevronDown className="h-4 w-4" />
        </Button>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8">
              Copy
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(context);
              toast.success("Context copied");
            }}>
              Copy
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Context Text Area */}
      <div 
        className={`flex-1 rounded-xl p-4 transition-colors bg-white border shadow-sm ${
          isDragging ? 'border-primary' : 'border-border'
        }`}
        onDragOver={(e) => {
          handleDragOver(e);
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          handleDragLeave(e);
          setIsDragging(false);
        }}
        onDrop={(e) => {
          handleFileDrop(e);
          setIsDragging(false);
        }}
      >
        <Textarea
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="Add patient details"
          className="h-full min-h-[400px] text-base sm:text-lg leading-relaxed resize-none border-0 bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />
      </div>

      {/* Bottom Section */}
      <div className="flex h-fit w-full bg-surface p-4">
        <div className="grid flex-1 grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr] gap-x-1.5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium leading-snug tracking-normal whitespace-nowrap">Past sessions</p>
            <div role="none" className="bg-border h-px w-full flex-1" />
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium leading-snug tracking-normal min-w-fit">
              {uploadedFiles.length > 0 ? `${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? 's' : ''}` : 'No attachments'}
            </p>
            <div role="none" className="bg-border h-px w-full flex-1" />
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              data-testid="create-note-from-context-button"
              className="h-8 min-w-8 gap-x-1 rounded-md text-xs font-medium leading-snug"
              disabled
            >
              Create note from context
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-w-9 size-9 p-1"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload files"
              data-testid="upload-file-button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button variant="outline" className="h-9 rounded-md px-3 py-2.5 text-sm min-w-fit text-muted-foreground">
              Not linked to a profile
            </Button>
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading file...
        </div>
      )}

    </div>
  );
}
