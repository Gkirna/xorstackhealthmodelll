import { useState, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <div className="space-y-4">
      {/* Context Input */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-3">
          <h3 className="text-[16px] font-semibold">Additional Context</h3>
          <p className="text-[14px] text-muted-foreground">
            Add notes, medical history, or relevant patient information (max 500
            characters)
          </p>
          <Textarea
            value={context}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                onContextChange(e.target.value);
              }
            }}
            placeholder="Enter additional clinical context, patient history, medications, allergies, or any relevant information..."
            className="min-h-[200px] text-[16px] leading-relaxed resize-none"
            maxLength={500}
          />
          <div className="text-right">
            <span className="text-[12px] text-muted-foreground">
              {context.length}/500 characters
            </span>
          </div>
        </div>
      </Card>

      {/* File Drop Zone */}
      <Card
        className="p-8 rounded-3xl border-2 border-dashed border-accent-light hover:border-accent transition-colors cursor-pointer"
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-4 bg-accent/10 rounded-full">
            <Upload className="h-8 w-8 text-accent" />
          </div>
          <div>
            <p className="text-[16px] font-medium">
              {isUploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="text-[14px] text-muted-foreground">
              Upload lab results, imaging reports, or other documents
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground">
            PDF, DOCX, JPG, PNG (max 10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </div>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card className="p-4 rounded-3xl">
          <h4 className="text-[14px] font-semibold mb-3">Uploaded Files</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
