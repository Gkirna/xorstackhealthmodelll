/**
 * Intelligent Transcription Dashboard
 * Complete workflow: Deepgram → GPT → Structured Output
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Brain, 
  Users, 
  Activity, 
  Zap, 
  CheckCircle,
  Clock,
  Heart,
  AlertTriangle,
  User,
  UserCheck,
  Stethoscope,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useIntelligentTranscription } from '@/hooks/useIntelligentTranscription';

interface IntelligentTranscriptionDashboardProps {
  sessionId: string;
  onTranscriptionComplete?: (output: any) => void;
}

export function IntelligentTranscriptionDashboard({
  sessionId,
  onTranscriptionComplete
}: IntelligentTranscriptionDashboardProps) {
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useState<NodeJS.Timeout | null>(null);

  const {
    isActive,
    isProcessing,
    status,
    structuredOutput,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    getTranscriptPreview,
    getMedicalEntitiesSummary,
    getConversationSummary
  } = useIntelligentTranscription(sessionId);

  const handleStart = async () => {
    const started = await startTranscription();
    if (started) {
      // Start timer
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      timerRef[1](interval);
    }
  };

  const handleStop = async () => {
    const output = await stopTranscription();
    if (output && onTranscriptionComplete) {
      onTranscriptionComplete(output);
    }
    
    // Stop timer
    if (timerRef[0]) {
      clearInterval(timerRef[0]);
      timerRef[1](null);
    }
    setDuration(0);
  };

  const handlePause = () => {
    pauseTranscription();
    setIsPaused(true);
    
    // Pause timer
    if (timerRef[0]) {
      clearInterval(timerRef[0]);
      timerRef[1](null);
    }
  };

  const handleResume = async () => {
    await resumeTranscription();
    setIsPaused(false);
    
    // Resume timer
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    timerRef[1](interval);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'doctor': return <Stethoscope className="h-4 w-4" />;
      case 'patient': return <User className="h-4 w-4" />;
      default: return <UserCheck className="h-4 w-4" />;
    }
  };

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'male': return '👨';
      case 'female': return '👩';
      default: return '👤';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Intelligent Transcription Pipeline
          </CardTitle>
          <CardDescription>
            Deepgram → GPT → Structured Output with Role Assignment & Gender Inference
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workflow Steps */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <h4 className="font-medium">1. Diarization</h4>
              <p className="text-sm text-muted-foreground">Detect speakers</p>
              <Badge variant={status.speakersDetected > 0 ? "default" : "secondary"}>
                {status.speakersDetected} speakers
              </Badge>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <Mic className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <h4 className="font-medium">2. Transcription</h4>
              <p className="text-sm text-muted-foreground">Deepgram ASR</p>
              <Badge variant={status.segmentsProcessed > 0 ? "default" : "secondary"}>
                {status.segmentsProcessed} segments
              </Badge>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <Brain className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <h4 className="font-medium">3. GPT Analysis</h4>
              <p className="text-sm text-muted-foreground">Clean & analyze</p>
              <Badge variant={structuredOutput ? "default" : "secondary"}>
                {structuredOutput ? "Complete" : "Processing"}
              </Badge>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isActive && (
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              )}
              <span className="font-mono text-lg">{formatDuration(duration)}</span>
              {status.currentSpeaker && (
                <Badge variant="outline">
                  Current: {status.currentSpeaker}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!isActive ? (
                <Button onClick={handleStart} disabled={isProcessing}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Pipeline
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button onClick={handleResume} variant="secondary">
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={handlePause} variant="secondary">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button onClick={handleStop} variant="destructive">
                    <Square className="mr-2 h-4 w-4" />
                    Stop & Analyze
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing with GPT...</span>
                <span className="font-medium">Analyzing conversation</span>
              </div>
              <Progress value={undefined} className="animate-pulse" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {structuredOutput && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Structured Output
            </CardTitle>
            <CardDescription>
              Complete analysis with role assignment, gender inference, and medical entities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transcript" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="speakers">Speakers</TabsTrigger>
                <TabsTrigger value="entities">Medical Entities</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transcript" className="space-y-4">
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {structuredOutput.speakers.map((speaker, speakerIndex) => (
                    <div key={speakerIndex} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(speaker.role)}
                        <Badge variant="outline">{speaker.role}</Badge>
                        <span className="text-lg">{getGenderIcon(speaker.gender)}</span>
                        <Badge variant="secondary">{speaker.speakerId}</Badge>
                      </div>
                      
                      {speaker.segments.map((segment, segmentIndex) => (
                        <div key={segmentIndex} className="p-3 border rounded-lg ml-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {Math.round(segment.confidence * 100)}% confidence
                              </Badge>
                              <Badge className={getSentimentColor(segment.analysis.sentiment)}>
                                {segment.analysis.sentiment}
                              </Badge>
                              <Badge className={getUrgencyColor(segment.analysis.urgency)}>
                                {segment.analysis.urgency} urgency
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(segment.startTime)}s - {Math.round(segment.endTime)}s
                            </span>
                          </div>
                          <p className="text-sm">{segment.cleanedText}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="speakers" className="space-y-4">
                <div className="grid gap-4">
                  {structuredOutput.speakers.map((speaker, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        {getRoleIcon(speaker.role)}
                        <div>
                          <h3 className="font-medium">{speaker.role}</h3>
                          <p className="text-sm text-muted-foreground">
                            {speaker.speakerId} • {speaker.gender}
                          </p>
                        </div>
                        <span className="text-2xl ml-auto">{getGenderIcon(speaker.gender)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Segments:</span>
                          <span className="font-medium ml-2">{speaker.segments.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Confidence:</span>
                          <span className="font-medium ml-2">
                            {Math.round(
                              speaker.segments.reduce((sum, s) => sum + s.confidence, 0) / 
                              speaker.segments.length * 100
                            )}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium ml-2">
                            {Math.round(
                              speaker.segments.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)
                            )}s
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="entities" className="space-y-4">
                <div className="space-y-3">
                  {Object.entries(getMedicalEntitiesSummary()).map(([category, entities]) => (
                    <div key={category} className="p-3 border rounded-lg">
                      <h4 className="font-medium mb-2 capitalize">{category}</h4>
                      <div className="flex flex-wrap gap-2">
                        {entities.map((entity, index) => (
                          <Badge key={index} variant="outline">
                            {entity.text} ({Math.round(entity.confidence * 100)}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Session Statistics
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Duration:</span>
                        <span className="font-medium">{Math.round(structuredOutput.summary.totalDuration)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Speakers:</span>
                        <span className="font-medium">{structuredOutput.summary.speakerCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Medical Entities:</span>
                        <span className="font-medium">{structuredOutput.summary.medicalEntitiesFound}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Analysis Results
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Overall Sentiment:</span>
                        <Badge className={getSentimentColor(structuredOutput.summary.overallSentiment)}>
                          {structuredOutput.summary.overallSentiment}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Urgency Level:</span>
                        <Badge className={getUrgencyColor(structuredOutput.summary.urgencyLevel)}>
                          {structuredOutput.summary.urgencyLevel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
