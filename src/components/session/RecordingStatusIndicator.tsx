import { motion } from 'framer-motion';
import { Mic, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RecordingStatusIndicatorProps {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  audioLevel: number;
}

export function RecordingStatusIndicator({
  isRecording,
  isProcessing,
  duration,
  audioLevel,
}: RecordingStatusIndicatorProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording && !isProcessing) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed top-20 right-6 z-50"
    >
      <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[280px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            ) : (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Mic className="h-5 w-5 text-red-500" />
              </motion.div>
            )}
            <span className="font-semibold">
              {isProcessing ? 'Processing...' : 'Recording'}
            </span>
          </div>
          <Badge variant={isRecording ? "destructive" : "default"} className="ml-2">
            {isProcessing ? 'PROCESSING' : 'LIVE'}
          </Badge>
        </div>

        {isRecording && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Duration:</span>
              <span className="text-sm font-mono font-semibold">{formatDuration(duration)}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Audio Level:</span>
                <span className="text-xs font-medium">{Math.round(audioLevel)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  animate={{ width: `${audioLevel}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Active Transcription</span>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
