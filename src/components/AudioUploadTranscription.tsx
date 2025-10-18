import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const [processingStage, setProcessingStage] = useState<string>('');

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
      setProcessingStage('Preparing upload...');

      // Upload to Supabase Storage
      const fileName = sessionId 
        ? `${sessionId}/${Date.now()}-${selectedFile.name}`
        : `uploads/${Date.now()}-${selectedFile.name}`;

      console.log('📤 Uploading audio file:', fileName);
      setProcessingStage('Uploading audio...');

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);
      console.log('✅ Audio uploaded successfully');
      setProcessingStage('Upload complete');

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
      setProcessingStage('');
    }
  };

  const transcribeAudio = async (audioFile: File) => {
    try {
      setIsTranscribing(true);
      setUploadProgress(70);
      setProcessingStage('Preparing audio for transcription...');

      console.log('🎙️ Starting transcription...');
      console.log('File size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');

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
      setProcessingStage('Transcribing audio...');

      // Call transcription edge function
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          session_id: sessionId,
        },
      });

      if (error) throw error;

      setUploadProgress(100);
      setProcessingStage('Complete!');

      const transcriptText = data?.text || '';
      setTranscript(transcriptText);

      if (onTranscriptGenerated) {
        onTranscriptGenerated(transcriptText);
      }

      toast.success('Audio transcribed successfully!');
      console.log('✅ Transcription complete');
      console.log('Transcript length:', transcriptText.length, 'characters');

    } catch (error: any) {
      console.error('❌ Transcription error:', error);
      const errorMessage = error?.message || 'Failed to transcribe audio';
      toast.error(errorMessage);
      setProcessingStage('Error occurred');
    } finally {
      setIsTranscribing(false);
      setTimeout(() => setProcessingStage(''), 2000);
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
      <CardContent className="p-2 space-y-2">
        {!selectedFile ? (
          <div className="border border-dashed border-muted-foreground/30 rounded-md p-3 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload" className="cursor-pointer">
              <FileAudio className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-[11px] font-medium mb-0.5">Click to upload audio file</p>
              <p className="text-[10px] text-muted-foreground">
                Supports MP3, WAV, M4A, and other audio formats (max 50MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-1.5 bg-muted rounded">
              <div className="flex items-center gap-1.5">
                <FileAudio className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[11px] font-medium">{selectedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">
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
                <X className="h-3 w-3" />
              </Button>
            </div>

            <Button
              onClick={handleUploadAndTranscribe}
              disabled={isUploading || isTranscribing}
              className="w-full h-7 text-xs"
            >
              {isUploading || isTranscribing ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Transcribing...'}
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3 w-3" />
                  Upload & Transcribe
                </>
              )}
            </Button>

            {(isUploading || isTranscribing) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {processingStage || (isUploading ? 'Uploading...' : 'Transcribing...')}
                  </span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1" />
              </div>
            )}

            {audioUrl && !isTranscribing && (
              <div className="pt-1.5 border-t">
                <p className="text-[11px] text-muted-foreground mb-1">Audio preview</p>
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}

            {transcript && (
              <div className="pt-1.5 border-t">
                <p className="text-[11px] text-muted-foreground mb-1">Transcript</p>
                <div className="p-1.5 bg-muted rounded">
                  <p className="text-[11px] whitespace-pre-wrap">{transcript}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
