import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Play, Pause, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { RealTimeTranscription } from '@/utils/RealTimeTranscription';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AudioRecorderWithTranscriptionProps {
  sessionId?: string;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  onFinalTranscriptChunk?: (text: string) => void;
}

export function AudioRecorderWithTranscription({
  sessionId,
  onTranscriptUpdate,
  onRecordingComplete,
  onFinalTranscriptChunk,
}: AudioRecorderWithTranscriptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcriptSupported, setTranscriptSupported] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<RealTimeTranscription | null>(null);

  useEffect(() => {
    // Initialize transcription engine
    transcriptionRef.current = new RealTimeTranscription({
      continuous: true,
      interimResults: true,
      lang: 'en-US',
      onResult: (transcript, isFinal) => {
        console.log('Transcription result:', { transcript, isFinal });
        
        if (isFinal) {
          // Send final transcript to parent
          if (onFinalTranscriptChunk) {
            onFinalTranscriptChunk(transcript);
          }
          setInterimTranscript('');
        } else {
          // Update interim transcript for display
          setInterimTranscript(transcript);
        }
        
        // Always notify parent of updates
        if (onTranscriptUpdate) {
          onTranscriptUpdate(transcript, isFinal);
        }
      },
      onError: (error) => {
        console.error('Transcription error:', error);
        toast.error(error);
      },
      onStart: () => {
        console.log('Transcription started');
        setIsTranscribing(true);
      },
      onEnd: () => {
        console.log('Transcription ended');
        setIsTranscribing(false);
      },
    });

    setTranscriptSupported(transcriptionRef.current.isBrowserSupported());

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (transcriptionRef.current) {
        transcriptionRef.current.destroy();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        stream.getTracks().forEach(track => track.stop());
        
        // Stop transcription
        if (transcriptionRef.current) {
          transcriptionRef.current.stop();
        }
        
        // Upload to storage if sessionId is provided
        if (sessionId) {
          await uploadAudio(audioBlob);
        } else if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      
      // Start transcription
      if (transcriptionRef.current && transcriptSupported) {
        const started = transcriptionRef.current.start();
        if (!started) {
          toast.warning('Real-time transcription not available. You can still record and transcribe later.');
        }
      } else {
        toast.warning('Real-time transcription not supported in this browser. Using Chrome is recommended.');
      }
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      toast.error('Failed to access microphone. Please grant permission.');
      console.error('Microphone access error:', error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      // Pause transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.pause();
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info('Recording paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume transcription
      if (transcriptionRef.current) {
        transcriptionRef.current.resume();
      }
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      toast.success('Recording resumed');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success('Recording stopped');
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    if (!sessionId) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const fileName = `${sessionId}/${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (error) throw error;

      setUploadProgress(100);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(fileName);

      toast.success('Recording uploaded successfully');
      
      if (onRecordingComplete) {
        onRecordingComplete(audioBlob, publicUrl);
      }

      setIsUploading(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload recording');
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Audio Recording
          </CardTitle>
          {isTranscribing && (
            <Badge variant="secondary" className="gap-1.5">
              <Zap className="h-3 w-3" />
              Live Transcription
            </Badge>
          )}
        </div>
        <CardDescription>
          Record consultation audio with real-time transcription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!transcriptSupported && (
          <Alert>
            <AlertDescription>
              Real-time transcription is not supported in this browser. Please use Chrome, Edge, or Safari for the best experience.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            )}
            <span className="font-mono text-lg">{formatDuration(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button onClick={startRecording}>
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button onClick={resumeRecording} variant="secondary">
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={pauseRecording} variant="secondary">
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button onClick={stopRecording} variant="destructive">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Show interim transcript while recording */}
        {interimTranscript && isRecording && (
          <div className="p-3 bg-muted/50 rounded-lg border-2 border-dashed border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Live transcription (interim):</p>
            <p className="text-sm italic text-muted-foreground">{interimTranscript}</p>
          </div>
        )}

        {isUploading && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {audioURL && !isUploading && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Recording preview:</p>
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
