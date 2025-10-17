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
      <CardContent className="p-2 space-y-2">
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
          <div className="flex items-center gap-1.5">
            <Mic className="h-4 w-4 text-muted-foreground" />
            {isRecording && <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />}
            <span className="font-mono text-xs">{formatDuration(duration)}</span>
            {isTranscribing && (
              <Badge variant="secondary" className="h-5 px-1 py-0 text-[10px] gap-1">
                <Zap className="h-3 w-3" />
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isRecording ? (
              <Button onClick={startRecording} size="icon" className="h-7 w-7" disabled={!transcriptSupported}>
                <Mic className="h-3.5 w-3.5" />
                <span className="sr-only">Start dictating</span>
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button onClick={resumeRecording} variant="secondary" size="icon" className="h-7 w-7">
                    <Play className="h-3.5 w-3.5" />
                    <span className="sr-only">Resume</span>
                  </Button>
                ) : (
                  <Button onClick={pauseRecording} variant="secondary" size="icon" className="h-7 w-7">
                    <Pause className="h-3.5 w-3.5" />
                    <span className="sr-only">Pause</span>
                  </Button>
                )}
                <Button onClick={stopRecording} variant="destructive" size="icon" className="h-7 w-7">
                  <Square className="h-3.5 w-3.5" />
                  <span className="sr-only">Stop</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Show interim transcript while recording */}
        {interimTranscript && isRecording && (
          <div className="p-2 bg-muted/40 rounded border border-dashed border-primary/20">
            <p className="text-[10px] text-muted-foreground mb-0.5">Live dictation</p>
            <p className="text-xs italic text-muted-foreground">{interimTranscript}</p>
          </div>
        )}

        {audioURL && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Recording preview</p>
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
