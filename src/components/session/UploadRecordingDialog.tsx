import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface UploadRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, mode: "transcribe" | "dictate") => void;
}

export function UploadRecordingDialog({ open, onOpenChange, onUpload }: UploadRecordingDialogProps) {
  const [selectedMode, setSelectedMode] = useState<"transcribe" | "dictate">("transcribe");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
      if (validFormats.includes(file.type) || file.name.match(/\.(mp3|wav|mp4|m4a)$/i)) {
        setSelectedFile(file);
      } else {
        toast.error("Please upload a valid audio file (mp3, wav, mp4)");
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const validFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
      if (validFormats.includes(file.type) || file.name.match(/\.(mp3|wav|mp4|m4a)$/i)) {
        setSelectedFile(file);
      } else {
        toast.error("Please upload a valid audio file (mp3, wav, mp4)");
      }
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile, selectedMode);
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Upload a recording</DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={selectedMode === "transcribe" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setSelectedMode("transcribe")}
          >
            Transcribe
          </Button>
          <Button
            variant={selectedMode === "dictate" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setSelectedMode("dictate")}
          >
            Dictate
          </Button>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleUploadClick} className="w-full">
                Upload & Process
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Click or drag file to this area to upload</p>
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: mp3, wav, mp4
              </p>
              <input
                type="file"
                accept=".mp3,.wav,.mp4,.m4a"
                onChange={handleFileChange}
                className="hidden"
                id="audio-upload"
              />
              <Button variant="outline" onClick={() => document.getElementById('audio-upload')?.click()}>
                Select File
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
