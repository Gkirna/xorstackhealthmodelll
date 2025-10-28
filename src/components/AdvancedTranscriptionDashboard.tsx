import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Users, Activity, Pill, HeartPulse, Stethoscope, AlertCircle, FileText, Syringe } from 'lucide-react';
import type { EnhancedTranscriptionData, MedicalEntity, TranscriptionSegment } from '@/types/advancedTranscription';

interface AdvancedTranscriptionDashboardProps {
  data: EnhancedTranscriptionData | null;
}

const entityIcons: Record<string, any> = {
  medication: Pill,
  diagnosis: AlertCircle,
  procedure: Stethoscope,
  symptom: HeartPulse,
  anatomy: Activity,
  dosage: Syringe,
  vital_sign: Activity,
  allergy: AlertCircle,
};

const entityColors: Record<string, string> = {
  medication: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  diagnosis: 'bg-red-500/10 text-red-700 dark:text-red-300',
  procedure: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  symptom: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  anatomy: 'bg-green-500/10 text-green-700 dark:text-green-300',
  dosage: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  vital_sign: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  allergy: 'bg-pink-500/10 text-pink-700 dark:text-pink-300',
};

export const AdvancedTranscriptionDashboard = ({ data }: AdvancedTranscriptionDashboardProps) => {
  if (!data) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Advanced Transcription Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No transcription data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const confidencePercent = Math.round(data.confidence * 100);
  const avgEntityConfidence = Math.round(data.statistics.avg_confidence * 100);

  return (
    <div className="space-y-4">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{confidencePercent}%</div>
              <Progress value={confidencePercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Speakers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.speaker_count}</div>
            <p className="text-xs text-muted-foreground">Identified speakers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.segments.length}</div>
            <p className="text-xs text-muted-foreground">Conversation parts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.total_entities}</div>
            <p className="text-xs text-muted-foreground">{avgEntityConfidence}% confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Medical Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Medical Entities Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Entity Type Summary */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.statistics.by_type).map(([type, count]) => {
                const Icon = entityIcons[type] || FileText;
                return (
                  <Badge key={type} variant="outline" className={entityColors[type]}>
                    <Icon className="h-3 w-3 mr-1" />
                    {type}: {count}
                  </Badge>
                );
              })}
            </div>

            <Separator />

            {/* Entity List */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {data.entities.map((entity, idx) => {
                  const Icon = entityIcons[entity.type] || FileText;
                  const confidence = Math.round(entity.confidence * 100);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entity.text}</span>
                        <Badge variant="outline" className={entityColors[entity.type]}>
                          {entity.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{confidence}%</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Speaker Segments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Speaker Diarization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {data.segments.map((segment, idx) => {
                const confidence = Math.round(segment.confidence * 100);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        Speaker {segment.speaker}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s</span>
                        <Badge variant="secondary" className="text-xs">
                          {confidence}%
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
