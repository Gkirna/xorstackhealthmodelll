import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Play, Pause, Zap, Volume2, Download, Trash2 } from 'lucide-react';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useTranscription } from '@/hooks/useTranscription';
import { toast } from 'sonner';

interface DictatingPanelProps {
  sessionId?: string;
  deviceId?: string;
}

export function DictatingPanel({
  sessionId,
  deviceId,
}: DictatingPanelProps) {
  const { addTranscriptChunk } = useTranscription(sessionId || '');

  const {
    isRecording,
    isPaused,
    duration,
    isTranscribing,
    interimTranscript,
    transcriptSupported,
    error,
    audioLevel,
    recordedUrl,
    recordedBlob,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearRecording,
    formatDuration,
  } = useAudioRecording({
    onTranscriptUpdate: (text, isFinal) => {
      console.log('📝 Real-time dictation:', { length: text.length, isFinal, preview: text.substring(0, 50) });
    },
    onFinalTranscriptChunk: async (text) => {
      console.log('✅ Saving final dictation chunk to DB:', text.substring(0, 50), '...');
      if (sessionId) {
        await addTranscriptChunk(text, 'provider');
        toast.success(`Saved ${text.split(/\s+/).length} words`);
      }
    },
    onRecordingComplete: (blob, url) => {
      console.log('🎙️ Dictation recording complete:', {
        size: (blob.size / 1024).toFixed(2) + ' KB',
        duration: formatDuration(duration)
      });
      toast.success('Recording saved successfully');
    },
    onError: (error) => {
      console.error('❌ Dictation error:', error);
      toast.error(error);
    },
    deviceId: deviceId !== 'default' ? deviceId : undefined,
  });

  const handleDownload = () => {
    if (!recordedBlob || !recordedUrl) return;
    
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `dictation-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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

        {/* Audio Level Indicator */}
        {isRecording && !isPaused && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Audio Level</span>
            </div>
            <Progress value={audioLevel} className="h-1" />
          </div>
        )}

        {/* Show interim transcript while recording */}
        {interimTranscript && isRecording && (
          <div className="p-2 bg-muted/40 rounded border border-dashed border-primary/20">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Live dictation
            </p>
            <p className="text-xs italic text-muted-foreground">{interimTranscript}</p>
          </div>
        )}

        {recordedUrl && !isRecording && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Recording preview</p>
              <div className="flex gap-1">
                <Button onClick={handleDownload} variant="outline" size="sm" className="h-6 px-2 text-[10px]">
                  <Download className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button onClick={clearRecording} variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
            <audio src={recordedUrl} controls className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
