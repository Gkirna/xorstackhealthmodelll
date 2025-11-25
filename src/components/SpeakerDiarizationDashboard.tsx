import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User, Stethoscope, TrendingUp } from 'lucide-react';

interface SpeakerDiarizationDashboardProps {
  statistics: {
    totalSegments: number;
    doctorSegments: number;
    patientSegments: number;
    avgDoctorConfidence: number;
    avgPatientConfidence: number;
    doctorProfile: any;
    patientProfile: any;
  } | null;
}

export const SpeakerDiarizationDashboard = ({ statistics }: SpeakerDiarizationDashboardProps) => {
  if (!statistics) return null;

  const doctorPercentage = statistics.totalSegments > 0 
    ? (statistics.doctorSegments / statistics.totalSegments * 100).toFixed(1)
    : 0;
  
  const patientPercentage = statistics.totalSegments > 0 
    ? (statistics.patientSegments / statistics.totalSegments * 100).toFixed(1)
    : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Advanced Speaker Diarization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Total Segments</div>
            <div className="text-2xl font-bold">{statistics.totalSegments}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Speakers Detected</div>
            <div className="text-2xl font-bold">2</div>
          </div>
        </div>

        {/* Doctor Profile */}
        <div className="space-y-2 border-l-2 border-primary pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="font-semibold">Doctor</span>
            </div>
            <Badge variant="secondary">
              {(statistics.avgDoctorConfidence * 100).toFixed(0)}% confidence
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Segments</div>
              <div className="font-medium">{statistics.doctorSegments} ({doctorPercentage}%)</div>
            </div>
            {statistics.doctorProfile && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Pitch</div>
                  <div className="font-medium">
                    {statistics.doctorProfile.voiceSignature.avgPitch.toFixed(0)} Hz
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gender</div>
                  <div className="font-medium capitalize">
                    {statistics.doctorProfile.voiceSignature.gender}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Samples</div>
                  <div className="font-medium">{statistics.doctorProfile.sampleCount}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Patient Profile */}
        <div className="space-y-2 border-l-2 border-accent pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-accent" />
              <span className="font-semibold">Patient</span>
            </div>
            <Badge variant="secondary">
              {(statistics.avgPatientConfidence * 100).toFixed(0)}% confidence
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Segments</div>
              <div className="font-medium">{statistics.patientSegments} ({patientPercentage}%)</div>
            </div>
            {statistics.patientProfile && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Pitch</div>
                  <div className="font-medium">
                    {statistics.patientProfile.voiceSignature.avgPitch.toFixed(0)} Hz
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gender</div>
                  <div className="font-medium capitalize">
                    {statistics.patientProfile.voiceSignature.gender}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Samples</div>
                  <div className="font-medium">{statistics.patientProfile.sampleCount}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quality Indicator */}
        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span>
            Speaker diarization active with{' '}
            <strong>{((statistics.avgDoctorConfidence + statistics.avgPatientConfidence) / 2 * 100).toFixed(0)}%</strong>{' '}
            average confidence
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
