import { useState, useRef } from "react";
import { FileText, Loader2, Mic, ChevronDown, Undo, Redo } from "lucide-react";
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
      <div className="flex justify-end mb-4 gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Mic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Redo className="h-4 w-4" />
        </Button>
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
        className={`flex-1 rounded-lg p-4 transition-colors bg-white border ${
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
          placeholder="Add any additional context about the patient or paste files here"
          className="h-full min-h-[400px] text-sm leading-relaxed resize-none border bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
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
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex gap-6 text-sm">
          <button className="text-muted-foreground hover:text-foreground">
            Past sessions
          </button>
          <span className="text-muted-foreground">
            {uploadedFiles.length > 0 ? `${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? 's' : ''}` : 'No attachments'}
          </span>
        </div>
        <Button variant="ghost" className="text-sm text-muted-foreground">
          Create note from context →
        </Button>
      </div>

      {isUploading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading file...
        </div>
      )}

      {/* Profile Link */}
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>Not linked to a profile</span>
      </div>
    </div>
  );
}
