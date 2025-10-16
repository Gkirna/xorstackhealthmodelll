import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileAudio, CheckCircle } from 'lucide-react';
import { useAudioUpload } from '@/hooks/useAudioUpload';

interface UploadAudioPanelProps {
  sessionId?: string;
  onTranscriptGenerated?: (text: string) => void;
  onAudioUploaded?: (url: string) => void;
}

export function UploadAudioPanel({
  sessionId,
  onTranscriptGenerated,
  onAudioUploaded,
}: UploadAudioPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const {
    isUploading,
    uploadProgress,
    error,
    uploadedFile,
    audioUrl,
    uploadAudio,
    removeAudio,
    formatFileSize,
    validateFile,
  } = useAudioUpload({
    sessionId,
    onTranscriptGenerated,
    onAudioUploaded,
  });

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      return;
    }
    await uploadAudio(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Session Audio
        </CardTitle>
        <CardDescription>
          Upload audio files (.mp3, .wav, .m4a) for transcription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {!uploadedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload audio file</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your audio file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supported formats: .mp3, .wav, .m4a, .webm (max 50MB)
            </p>
            <Button onClick={openFileDialog} disabled={isUploading}>
              <Upload className="mr-2 h-4 w-4" />
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.webm"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading {uploadedFile.name}...</span>
                  <span className="font-medium">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Uploaded File Info */}
            {uploadedFile && !isUploading && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                  {audioUrl && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openFileDialog}
                    disabled={isUploading}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeAudio}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Audio Player */}
            {audioUrl && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Audio preview:</p>
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
