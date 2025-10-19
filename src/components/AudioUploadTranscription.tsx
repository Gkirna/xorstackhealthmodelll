import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileAudio, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useTranscription } from '@/hooks/useTranscription';

interface AudioUploadTranscriptionProps {
  sessionId?: string;
}

export function AudioUploadTranscription({
  sessionId,
}: AudioUploadTranscriptionProps) {
  const { addTranscriptChunk } = useTranscription(sessionId || '');
  
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
      console.log('✅ Audio available at:', publicUrl);

      setUploadProgress(60);
      setIsUploading(false);

      // Start transcription
      await transcribeAudio(selectedFile, fileName);

    } catch (error) {
      console.error('❌ Upload error:', error);
      toast.error('Failed to upload audio file');
      setIsUploading(false);
      setUploadProgress(0);
      setProcessingStage('');
    }
  };

  const transcribeAudio = async (audioFile: File, storagePath: string) => {
    try {
      setIsTranscribing(true);
      setUploadProgress(70);
      setProcessingStage('Preparing audio for transcription...');

      console.log('🎙️ Starting real-time transcription...');
      console.log('File:', audioFile.name);
      console.log('Size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');
      console.log('Type:', audioFile.type);

      // Convert audio file to base64 in chunks for better performance
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 10);
            setUploadProgress(70 + percentLoaded);
            setProcessingStage(`Reading audio: ${Math.round((e.loaded / e.total) * 100)}%`);
          }
        };
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          console.log('✅ Audio converted to base64:', (base64Data.length / 1024).toFixed(2), 'KB');
          resolve(base64Data);
        };
        reader.onerror = (error) => {
          console.error('❌ FileReader error:', error);
          reject(new Error('Failed to read audio file'));
        };
        reader.readAsDataURL(audioFile);
      });

      setUploadProgress(80);
      setProcessingStage('Sending to AI transcription engine...');
      console.log('📤 Invoking transcription edge function...');

      // Call transcription edge function with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transcription timeout - please try a smaller file')), 120000)
      );

      const transcriptionPromise = supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          session_id: sessionId,
        },
      });

      const { data, error } = await Promise.race([
        transcriptionPromise,
        timeoutPromise,
      ]) as any;

      if (error) {
        console.error('❌ Transcription edge function error:', error);
        throw error;
      }

      setUploadProgress(90);
      setProcessingStage('Processing AI response...');

      const transcriptText = data?.text || '';
      
      if (!transcriptText) {
        throw new Error('No transcript received from AI service');
      }

      setTranscript(transcriptText);
      const wordCount = transcriptText.split(/\s+/).length;
      
      console.log('✅ Transcription complete');
      console.log('Transcript length:', transcriptText.length, 'characters');
      console.log('Word count:', wordCount, 'words');

      // Save transcript to database
      if (sessionId) {
        setProcessingStage('Saving transcript to database...');
        await addTranscriptChunk(transcriptText, 'provider');
        console.log('💾 Transcript saved to database');
      }

      setUploadProgress(100);
      setProcessingStage('Complete!');
      toast.success(`Successfully transcribed and saved ${wordCount} words!`);

    } catch (error: any) {
      console.error('❌ Transcription error:', error);
      let errorMessage = 'Failed to transcribe audio';
      
      if (error?.message?.includes('timeout')) {
        errorMessage = 'Transcription timeout - file may be too large. Try a shorter recording.';
      } else if (error?.message?.includes('network')) {
        errorMessage = 'Network error - please check your connection and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setProcessingStage('Error: ' + errorMessage);
    } finally {
      setIsTranscribing(false);
      setTimeout(() => {
        if (!transcript) {
          setProcessingStage('');
        }
      }, 3000);
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
