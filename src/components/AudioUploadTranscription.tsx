import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileAudio, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface AudioUploadTranscriptionProps {
  sessionId?: string;
  onTranscriptGenerated?: (transcript: string) => void;
  onAudioUploaded?: (audioUrl: string) => void;
}

export function AudioUploadTranscription({
  sessionId,
  onTranscriptGenerated,
  onAudioUploaded,
}: AudioUploadTranscriptionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    toast.success('Audio file selected');
  };

  const handleUploadAndTranscribe = async () => {
    if (!selectedFile) {
      toast.error('Please select an audio file first');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Upload to Supabase Storage
      const fileName = sessionId 
        ? `${sessionId}/${Date.now()}-${selectedFile.name}`
        : `uploads/${Date.now()}-${selectedFile.name}`;

      console.log('📤 Uploading audio file:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);
      console.log('✅ Audio uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(fileName);

      setAudioUrl(publicUrl);
      
      if (onAudioUploaded) {
        onAudioUploaded(publicUrl);
      }

      setUploadProgress(60);
      setIsUploading(false);

      // Start transcription
      await transcribeAudio(selectedFile);

    } catch (error) {
      console.error('❌ Upload error:', error);
      toast.error('Failed to upload audio file');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const transcribeAudio = async (audioFile: File) => {
    try {
      setIsTranscribing(true);
      setUploadProgress(70);

      console.log('🎙️ Starting transcription...');

      // Convert audio file to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });

      setUploadProgress(80);

      // Call transcription edge function (you'll need to create this)
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          session_id: sessionId,
        },
      });

      if (error) throw error;

      setUploadProgress(100);

      const transcriptText = data?.text || '';
      setTranscript(transcriptText);

      if (onTranscriptGenerated) {
        onTranscriptGenerated(transcriptText);
      }

      toast.success('Audio transcribed successfully!');
      console.log('✅ Transcription complete');

    } catch (error) {
      console.error('❌ Transcription error:', error);
      toast.error('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setAudioUrl(null);
    setTranscript('');
    setUploadProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Audio Recording
        </CardTitle>
        <CardDescription>
          Upload an existing audio file to transcribe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload" className="cursor-pointer">
              <FileAudio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Click to upload audio file</p>
              <p className="text-xs text-muted-foreground">
                Supports MP3, WAV, M4A, and other audio formats (max 50MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileAudio className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={isUploading || isTranscribing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleUploadAndTranscribe}
              disabled={isUploading || isTranscribing}
              className="w-full"
            >
              {isUploading || isTranscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Transcribing...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Transcribe
                </>
              )}
            </Button>

            {(isUploading || isTranscribing) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isUploading ? 'Uploading...' : 'Transcribing...'}
                  </span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {audioUrl && !isTranscribing && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Audio preview:</p>
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}

            {transcript && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Transcript:</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
