import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, Square, Radio, WifiOff } from 'lucide-react';
import { useWebSocketTranscription } from '@/hooks/useWebSocketTranscription';

interface RealtimeTranscriptionPanelProps {
  sessionId: string;
  onTranscriptUpdate?: (transcript: string) => void;
}

export function RealtimeTranscriptionPanel({
  sessionId,
  onTranscriptUpdate,
}: RealtimeTranscriptionPanelProps) {
  const {
    isConnected,
    isTranscribing,
    interimText,
    finalText,
    segments,
    confidence,
    startTranscription,
    stopTranscription,
  } = useWebSocketTranscription(sessionId);

  // Update parent component with final text
  useEffect(() => {
    if (finalText && onTranscriptUpdate) {
      onTranscriptUpdate(finalText);
    }
  }, [finalText, onTranscriptUpdate]);

  const handleStart = async () => {
    try {
      await startTranscription();
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  const handleStop = async () => {
    await stopTranscription();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${isTranscribing ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
              Real-Time Transcription
            </CardTitle>
            <CardDescription>
              WebSocket-powered live transcription with speaker detection
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
            {confidence > 0 && (
              <Badge variant="outline">
                {Math.round(confidence * 100)}% confident
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          {!isTranscribing ? (
            <Button
              onClick={handleStart}
              className="flex-1"
              size="lg"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Live Transcription
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <Square className="mr-2 h-5 w-5" />
              Stop Transcription
            </Button>
          )}
        </div>

        {/* Live transcript display */}
        {isTranscribing && (
          <div className="space-y-3">
            <Alert>
              <Radio className="h-4 w-4 text-red-500 animate-pulse" />
              <AlertDescription>
                Listening and transcribing in real-time...
              </AlertDescription>
            </Alert>

            {/* Interim text */}
            {interimText && (
              <div className="p-3 bg-muted/50 rounded-md border border-muted">
                <p className="text-sm text-muted-foreground italic">
                  {interimText}
                </p>
              </div>
            )}

            {/* Final segments */}
            {segments.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {segments.map((segment, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-background rounded-md border"
                  >
                    <div className="flex items-start justify-between mb-1">
                      {segment.speaker !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          Speaker {segment.speaker}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(segment.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Final transcript summary */}
        {!isTranscribing && finalText && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Complete Transcript:</h4>
            <div className="p-4 bg-background rounded-md border max-h-[300px] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{finalText}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {segments.length} segments transcribed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
