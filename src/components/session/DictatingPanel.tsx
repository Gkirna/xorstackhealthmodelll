import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Play, Pause, Zap } from 'lucide-react';
import { useAudioRecording } from '@/hooks/useAudioRecording';

interface DictatingPanelProps {
  sessionId?: string;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
}

export function DictatingPanel({
  sessionId,
  onTranscriptUpdate,
  onFinalTranscriptChunk,
  onRecordingComplete,
}: DictatingPanelProps) {
  const [audioURL, setAudioURL] = useState<string | null>(null);

  const {
    isRecording,
    isPaused,
    duration,
    isTranscribing,
    interimTranscript,
    transcriptSupported,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    formatDuration,
  } = useAudioRecording({
    onTranscriptUpdate,
    onFinalTranscriptChunk,
    onRecordingComplete: (blob, url) => {
      setAudioURL(url || null);
      if (onRecordingComplete) {
        onRecordingComplete(blob, url);
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Dictating Mode
          </CardTitle>
          {isTranscribing && (
            <Badge variant="secondary" className="gap-1.5">
              <Zap className="h-3 w-3" />
              Live Transcription
            </Badge>
          )}
        </div>
        <CardDescription>
          Dictate your notes with real-time speech-to-text transcription
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
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
              <Button onClick={startRecording} disabled={!transcriptSupported}>
                <Mic className="mr-2 h-4 w-4" />
                Start Dictating
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
            <p className="text-xs text-muted-foreground mb-1">Live dictation (interim):</p>
            <p className="text-sm italic text-muted-foreground">{interimTranscript}</p>
          </div>
        )}

        {audioURL && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Recording preview:</p>
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
