/**
 * Enhanced Transcription Demo Page
 * Demonstrates Phase 1 improvements with professional ASR features
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Brain, 
  Users, 
  Activity, 
  Zap, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Settings
} from 'lucide-react';
import { AudioRecorderWithTranscription } from '@/components/AudioRecorderWithTranscription';
import { EnhancedAudioRecorder } from '@/components/EnhancedAudioRecorder';

export function EnhancedTranscriptionDemo() {
  const [useEnhanced, setUseEnhanced] = useState(true);
  const [sessionId] = useState(`demo-session-${Date.now()}`);

  const features = [
    {
      icon: <Brain className="h-5 w-5" />,
      title: "Professional ASR",
      description: "Deepgram integration with medical model",
      status: "completed"
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Speaker Diarization",
      description: "Automatic speaker identification",
      status: "completed"
    },
    {
      icon: <Activity className="h-5 w-5" />,
      title: "Medical NER",
      description: "Named Entity Recognition for clinical terms",
      status: "completed"
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Confidence Scoring",
      description: "Real-time confidence indicators",
      status: "completed"
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Phase 1: Enhanced Accuracy</h1>
        <p className="text-lg text-muted-foreground">
          Professional-grade transcription with confidence scoring and medical entity recognition
        </p>
      </div>

      {/* Feature Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Implemented Features
          </CardTitle>
          <CardDescription>
            All Phase 1 enhancements are now available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="text-green-600 mt-0.5">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{feature.title}</h3>
                    <Badge variant="default" className="text-xs">
                      {feature.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Choose between standard and enhanced transcription features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              variant={!useEnhanced ? "default" : "outline"}
              onClick={() => setUseEnhanced(false)}
            >
              <Mic className="h-4 w-4 mr-2" />
              Standard (Web Speech API)
            </Button>
            <Button
              variant={useEnhanced ? "default" : "outline"}
              onClick={() => setUseEnhanced(true)}
            >
              <Brain className="h-4 w-4 mr-2" />
              Enhanced (Deepgram + NER)
            </Button>
          </div>
          
          {useEnhanced && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Enhanced mode uses Deepgram's professional ASR with medical model, 
                speaker diarization, confidence scoring, and medical entity recognition.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Demo Tabs */}
      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recorder">Audio Recorder</TabsTrigger>
          <TabsTrigger value="features">Feature Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recorder" className="space-y-4">
          {useEnhanced ? (
            <EnhancedAudioRecorder
              sessionId={sessionId}
              onTranscriptUpdate={(text, isFinal) => {
                console.log('Transcript update:', { text, isFinal });
              }}
              onRecordingComplete={(blob, url) => {
                console.log('Recording complete:', { blob, url });
              }}
              onFinalTranscriptChunk={(text) => {
                console.log('Final chunk:', text);
              }}
            />
          ) : (
            <AudioRecorderWithTranscription
              sessionId={sessionId}
              useEnhancedFeatures={false}
              onTranscriptUpdate={(text, isFinal) => {
                console.log('Transcript update:', { text, isFinal });
              }}
              onRecordingComplete={(blob, url) => {
                console.log('Recording complete:', { blob, url });
              }}
              onFinalTranscriptChunk={(text) => {
                console.log('Final chunk:', text);
              }}
            />
          )}
        </TabsContent>
        
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4">
            {/* Deepgram Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Deepgram Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Model:</strong> nova-2-medical
                  </div>
                  <div>
                    <strong>Language:</strong> en-US
                  </div>
                  <div>
                    <strong>Features:</strong> Speaker diarization, Smart formatting
                  </div>
                  <div>
                    <strong>Confidence:</strong> Real-time scoring
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    Professional ASR service with medical domain expertise and 
                    advanced speaker diarization capabilities.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Medical NER */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Medical Named Entity Recognition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Medications
                    </Badge>
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      Conditions
                    </Badge>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Procedures
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      Anatomy
                    </Badge>
                    <Badge variant="outline" className="bg-orange-100 text-orange-800">
                      Symptoms
                    </Badge>
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      Other
                    </Badge>
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    Automatically identifies and categorizes medical terms in real-time 
                    with confidence scoring for each entity.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Confidence Scoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Confidence Scoring System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm">High Confidence (≥80%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Medium Confidence (60-79%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm">Low Confidence (<60%)</span>
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    Visual confidence indicators help identify transcription quality 
                    and areas that may need review.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
