import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Pause, Square, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptionControlPanelProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  recordingMode: string;
}

export function TranscriptionControlPanel({
  isRecording,
  isPaused,
  duration,
  isTranscribing,
  onStart,
  onPause,
  onResume,
  onStop,
  recordingMode,
}: TranscriptionControlPanelProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="fixed bottom-6 right-6 p-4 shadow-lg border-2 z-50 bg-background">
      <div className="flex flex-col gap-3 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className={cn(
              "h-5 w-5",
              isRecording && !isPaused && "text-red-500 animate-pulse"
            )} />
            <span className="font-semibold">
              {recordingMode === 'dictating' ? 'Dictation' : 'Transcription'}
            </span>
          </div>
          <div className="font-mono text-sm">
            {formatDuration(duration)}
          </div>
        </div>

        {/* Status */}
        <div className="text-sm text-muted-foreground">
          {!isRecording && "Ready to record"}
          {isRecording && isPaused && "Paused"}
          {isRecording && !isPaused && isTranscribing && "Recording & Transcribing..."}
          {isRecording && !isPaused && !isTranscribing && "Recording..."}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button 
              onClick={onStart}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button 
                  onClick={onResume}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button 
                  onClick={onPause}
                  variant="outline"
                  className="flex-1"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              <Button 
                onClick={onStop}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Live Indicator */}
        {isRecording && !isPaused && (
          <div className="flex items-center justify-center gap-2 text-xs text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            LIVE
          </div>
        )}
      </div>
    </Card>
  );
}
