/**
 * Enhanced Audio Recorder with Professional ASR Features
 * Displays confidence scores, speaker diarization, and medical entities
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, Square, Play, Pause, Zap, Brain, Users, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEnhancedTranscription, TranscriptionConfig } from '@/hooks/useEnhancedTranscription';
import { MedicalEntity } from '@/services/ASRService';

interface EnhancedAudioRecorderProps {
  sessionId?: string;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
  onFinalTranscriptChunk?: (text: string) => void;
}

export function EnhancedAudioRecorder({
  sessionId,
  onTranscriptUpdate,
  onRecordingComplete,
  onFinalTranscriptChunk,
}: EnhancedAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'deepgram' | 'webspeech' | 'auto'>('auto');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced transcription configuration
  const transcriptionConfig: TranscriptionConfig = {
    provider: selectedProvider,
    language: 'en-US',
    enableSpeakerDiarization: true,
    enableMedicalNER: true,
    confidenceThreshold: 0.6,
    model: 'nova-2-medical'
  };

  const {
    transcriptChunks,
    isTranscribing,
    stats,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    loadTranscripts,
    getFullTranscript,
    currentProvider,
    availableProviders
  } = useEnhancedTranscription(sessionId || '', transcriptionConfig);

  useEffect(() => {
    if (sessionId) {
      loadTranscripts();
    }
  }, [sessionId, loadTranscripts]);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting enhanced audio recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      console.log('✅ Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        console.log(`✅ Audio blob created: ${audioBlob.size} bytes`);
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Audio track stopped');
        });
        
        // Stop transcription
        await stopTranscription();
        
        // Upload to storage if sessionId is provided
        if (sessionId) {
          await uploadAudio(audioBlob);
        } else if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      
      console.log('🎙️ MediaRecorder started');
      
      // Start enhanced transcription
      const transcriptionStarted = await startTranscription();
      if (!transcriptionStarted) {
        console.warn('⚠️ Enhanced transcription failed to start');
        toast.warning('Enhanced transcription not available. You can still record and transcribe later.');
      }
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast.success('Enhanced recording started');
    } catch (error) {
      console.error('❌ Microphone access error:', error);
      toast.error('Failed to access microphone. Please grant permission.');
    }
  };

  const pauseRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      // Pause transcription
      await pauseTranscription();
      
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info('Recording paused');
    }
  };

  const resumeRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume transcription
      await resumeTranscription();
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      toast.success('Recording resumed');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success('Recording stopped');
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    if (!sessionId) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const fileName = `${sessionId}/${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (error) throw error;

      setUploadProgress(100);

      const { data: { publicUrl } } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(fileName);

      toast.success('Recording uploaded successfully');
      
      if (onRecordingComplete) {
        onRecordingComplete(audioBlob, publicUrl);
      }

      setIsUploading(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload recording');
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return { variant: 'default' as const, text: 'High' };
    if (confidence >= 0.6) return { variant: 'secondary' as const, text: 'Medium' };
    return { variant: 'destructive' as const, text: 'Low' };
  };

  const getEntityColor = (category: string) => {
    const colors = {
      medication: 'bg-blue-100 text-blue-800',
      condition: 'bg-red-100 text-red-800',
      procedure: 'bg-green-100 text-green-800',
      anatomy: 'bg-purple-100 text-purple-800',
      symptom: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  return (
    <div className="space-y-6">
      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Enhanced Audio Recording
            </CardTitle>
            <div className="flex items-center gap-2">
              {isTranscribing && (
                <Badge variant="secondary" className="gap-1.5">
                  <Zap className="h-3 w-3" />
                  Live Transcription
                </Badge>
              )}
              {currentProvider && (
                <Badge variant="outline" className="gap-1.5">
                  <Brain className="h-3 w-3" />
                  {currentProvider}
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Professional-grade transcription with confidence scoring and medical entity recognition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">ASR Provider</label>
            <div className="flex gap-2">
              {availableProviders.map(provider => (
                <Button
                  key={provider}
                  variant={selectedProvider === provider ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedProvider(provider as any)}
                  disabled={isRecording}
                >
                  {provider === 'deepgram' && <Brain className="h-3 w-3 mr-1" />}
                  {provider === 'webspeech' && <Mic className="h-3 w-3 mr-1" />}
                  {provider === 'auto' && <Activity className="h-3 w-3 mr-1" />}
                  {provider}
                </Button>
              ))}
            </div>
          </div>

          {/* Recording Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording && (
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              )}
              <span className="font-mono text-lg">{formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button onClick={startRecording}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button onClick={resumeRecording} variant="secondary">
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseRecording} variant="secondary">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Audio Preview */}
          {audioURL && !isUploading && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Recording preview:</p>
              <audio src={audioURL} controls className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcription Results */}
      {transcriptChunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Live Transcription
            </CardTitle>
            <CardDescription>
              Real-time transcription with confidence scoring and medical entity recognition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transcript" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="entities">Medical Entities</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transcript" className="space-y-4">
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {transcriptChunks.map((chunk, index) => {
                    const confidenceBadge = getConfidenceBadge(chunk.confidence_score);
                    return (
                      <div key={chunk.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {chunk.speaker === 'provider' ? 'Doctor' : 'Patient'}
                            </Badge>
                            <Badge variant={confidenceBadge.variant}>
                              {confidenceBadge.text} ({Math.round(chunk.confidence_score * 100)}%)
                            </Badge>
                            {chunk.asr_provider && (
                              <Badge variant="secondary" className="text-xs">
                                {chunk.asr_provider}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(chunk.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className={`text-sm ${getConfidenceColor(chunk.confidence_score)}`}>
                          {chunk.text}
                        </p>
                        {chunk.medical_entities && chunk.medical_entities.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {chunk.medical_entities.map((entity, entityIndex) => (
                              <Badge
                                key={entityIndex}
                                variant="outline"
                                className={`text-xs ${getEntityColor(entity.category)}`}
                              >
                                {entity.text} ({entity.category})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="entities" className="space-y-4">
                <div className="space-y-3">
                  {transcriptChunks
                    .flatMap(chunk => chunk.medical_entities || [])
                    .map((entity, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={getEntityColor(entity.category)}>
                            {entity.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(entity.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="font-medium">{entity.text}</p>
                        <p className="text-sm text-muted-foreground">{entity.label}</p>
                      </div>
                    ))}
                </div>
              </TabsContent>
              
              <TabsContent value="stats" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium mb-2">Transcription Quality</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Average Confidence</span>
                        <span className="font-medium">{Math.round(stats.averageConfidence * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">High Confidence</span>
                        <span className="text-green-600 font-medium">{stats.highConfidenceChunks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Medium Confidence</span>
                        <span className="text-yellow-600 font-medium">{stats.mediumConfidenceChunks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Low Confidence</span>
                        <span className="text-red-600 font-medium">{stats.lowConfidenceChunks}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium mb-2">Session Statistics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Chunks</span>
                        <span className="font-medium">{stats.totalChunks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Saved Chunks</span>
                        <span className="font-medium">{stats.savedChunks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Pending Chunks</span>
                        <span className="font-medium">{stats.pendingChunks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Medical Entities</span>
                        <span className="font-medium">{stats.totalMedicalEntities}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2">Connection Health</h4>
                  <div className="flex items-center gap-2">
                    {stats.connectionHealth === 'healthy' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm text-green-600">Healthy</span>
                      </>
                    )}
                    {stats.connectionHealth === 'degraded' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-sm text-yellow-600">Degraded</span>
                      </>
                    )}
                    {stats.connectionHealth === 'offline' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm text-red-600">Offline</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      Avg Latency: {stats.averageLatency}ms
                    </span>
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
