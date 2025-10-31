import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAssemblyAITranscription } from '@/hooks/useAssemblyAITranscription';

interface AssemblyAIRecorderProps {
  sessionId: string;
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  onFinalTranscript?: (text: string) => void;
}

export function AssemblyAIRecorder({ 
  sessionId, 
  onTranscriptUpdate,
  onFinalTranscript 
}: AssemblyAIRecorderProps) {
  const [duration, setDuration] = useState(0);
  const [currentPartial, setCurrentPartial] = useState('');
  
  const {
    isTranscribing,
    isConnected,
    fullTranscript,
    startTranscription,
    stopTranscription,
  } = useAssemblyAITranscription({
    onTranscriptChunk: (text, isFinal) => {
      if (isFinal) {
        // Final transcript chunk
        onTranscriptUpdate?.(text, true);
        onFinalTranscript?.(text);
        setCurrentPartial('');
      } else {
        // Partial/interim transcript
        setCurrentPartial(text);
        onTranscriptUpdate?.(text, false);
      }
    },
    onError: (error) => {
      console.error('Transcription error:', error);
    },
  });

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTranscribing) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTranscribing]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    await startTranscription();
  };

  const handleStop = () => {
    stopTranscription();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Real-Time Transcription (AssemblyAI)</span>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge variant="default" className="animate-pulse">
                Connected
              </Badge>
            )}
            {isTranscribing && (
              <Badge variant="destructive" className="animate-pulse">
                Recording
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isTranscribing && (
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            )}
            <span className="font-mono text-lg">{formatDuration(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isTranscribing ? (
              <Button onClick={handleStart} size="lg">
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Button>
            ) : (
              <Button onClick={handleStop} variant="destructive" size="lg">
                <Square className="mr-2 h-5 w-5" />
                Stop Recording
              </Button>
            )}
          </div>
        </div>

        {/* Real-time transcript display */}
        {isTranscribing && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Live Transcript:</div>
            <div className="min-h-[100px] max-h-[300px] overflow-y-auto p-4 bg-muted rounded-lg border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {fullTranscript}
                {currentPartial && (
                  <span className="text-muted-foreground italic">
                    {fullTranscript ? ' ' : ''}
                    {currentPartial}
                  </span>
                )}
                {!fullTranscript && !currentPartial && (
                  <span className="text-muted-foreground">
                    Start speaking to see transcript...
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>
            Powered by AssemblyAI - Real-time speech-to-text with industry-leading accuracy
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
