import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mic, Users, Activity, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface RealtimeTranscriptionStatusProps {
  isTranscribing: boolean;
  processingStatus: 'idle' | 'transcribing' | 'analyzing' | 'complete';
  speakerCount: number;
  segmentCount: number;
  entityCount: number;
  confidence: number;
  currentText: string;
  interimText: string;
}

export const RealtimeTranscriptionStatus = ({
  isTranscribing,
  processingStatus,
  speakerCount,
  segmentCount,
  entityCount,
  confidence,
  currentText,
  interimText,
}: RealtimeTranscriptionStatusProps) => {
  if (!isTranscribing && processingStatus === 'idle') {
    return null;
  }

  const statusConfig = {
    transcribing: {
      label: 'Transcribing Audio',
      icon: Mic,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    analyzing: {
      label: 'Analyzing Medical Content',
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    complete: {
      label: 'Analysis Complete',
      icon: Sparkles,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    idle: {
      label: 'Ready',
      icon: Mic,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/10',
      borderColor: 'border-muted/20',
    },
  };

  const config = statusConfig[processingStatus];
  const Icon = config.icon;
  const confidencePercent = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border ${config.borderColor} ${config.bgColor}`}>
        <div className="p-4 space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isTranscribing ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </motion.div>
              ) : (
                <Icon className={`h-5 w-5 ${config.color}`} />
              )}
              <span className={`font-medium ${config.color}`}>{config.label}</span>
            </div>

            {isTranscribing && (
              <Badge variant="outline" className="gap-1">
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-2 h-2 rounded-full bg-red-500"
                />
                LIVE
              </Badge>
            )}
          </div>

          {/* Real-time Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Speakers
              </div>
              <div className="text-lg font-bold">{speakerCount}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Segments</div>
              <div className="text-lg font-bold">{segmentCount}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Entities</div>
              <div className="text-lg font-bold">{entityCount}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Quality</div>
              <div className="text-lg font-bold">{confidencePercent}%</div>
            </div>
          </div>

          {/* Confidence Progress */}
          {confidence > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transcription Confidence</span>
                <span className={confidencePercent >= 80 ? 'text-green-600' : confidencePercent >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                  {confidencePercent}%
                </span>
              </div>
              <Progress value={confidencePercent} className="h-1" />
            </div>
          )}

          {/* Interim Text Preview */}
          {interimText && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing...
              </div>
              <div className="text-sm text-muted-foreground/70 italic line-clamp-2">
                "{interimText}"
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {processingStatus === 'analyzing' && (
            <div className="flex items-center gap-2 text-xs text-purple-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Extracting medical entities and analyzing content...</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
