import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileAudio, CheckCircle, X, PlayCircle, Save, AlertCircle } from 'lucide-react';
import { useAudioUpload } from '@/hooks/useAudioUpload';
import { useCreateSession } from '@/hooks/useSessions';
import { toast } from 'sonner';

interface SessionMetadata {
  patientName: string;
  appointmentType: string;
  notes: string;
}

export default function SessionUploadAudio() {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [processingStage, setProcessingStage] = useState<'upload' | 'transcription' | 'complete' | null>(null);
  const [transcript, setTranscript] = useState('');
  const [metadata, setMetadata] = useState<SessionMetadata>({
    patientName: '',
    appointmentType: 'consultation',
    notes: '',
  });
  const [audioMetadata, setAudioMetadata] = useState<{
    duration: number;
    format: string;
    size: number;
  } | null>(null);

  const createSession = useCreateSession();

  const {
    isUploading,
    uploadProgress,
    error,
    uploadedFile,
    audioUrl,
    uploadAudio,
    removeAudio,
    formatFileSize,
    validateFile,
  } = useAudioUpload({
    onTranscriptGenerated: (text) => {
      setTranscript(text);
      setProcessingStage('complete');
      toast.success('Transcription completed successfully!');
    },
    onAudioUploaded: (url) => {
      setProcessingStage('transcription');
    },
    maxFileSize: 100, // Increased to 100MB for longer sessions
  });

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      return;
    }

    // Extract audio metadata
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      setAudioMetadata({
        duration: Math.round(audio.duration),
        format: file.type,
        size: file.size,
      });
      URL.revokeObjectURL(audio.src);
    };

    setProcessingStage('upload');
    await uploadAudio(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleSaveSession = async () => {
    if (!transcript || !metadata.patientName) {
      toast.error('Please provide patient name');
      return;
    }

    try {
      const session = await createSession.mutateAsync({
        patient_name: metadata.patientName,
        appointment_type: metadata.appointmentType,
        chief_complaint: metadata.notes,
      });

      toast.success('Session created successfully!');
      navigate(`/session/${session.id}/review`);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create session');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Upload Pre-recorded Session</h1>
          <p className="text-muted-foreground">
            Upload audio files from pre-recorded medical consultations for transcription and clinical note generation
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Audio File Upload
            </CardTitle>
            <CardDescription>
              Drag and drop or click to upload. Supports MP3, WAV, M4A, WebM, OGG, AAC, FLAC up to 100MB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!uploadedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Drop your audio file here</h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse from your device
                </p>
                <p className="text-sm text-muted-foreground">
                  Supported formats: MP3, WAV, M4A, WebM, OGG, AAC, FLAC (max 100MB)
                </p>
                <input
                  id="file-input"
                  type="file"
                  accept=".mp3,.wav,.m4a,.webm,.ogg,.aac,.flac"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <FileAudio className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-semibold">{uploadedFile.name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{formatFileSize(uploadedFile.size)}</span>
                        {audioMetadata && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(audioMetadata.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeAudio}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Processing Progress */}
                {processingStage && processingStage !== 'complete' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-sm font-medium">
                          {processingStage === 'upload' ? 'Uploading file...' : 'Transcribing audio...'}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground">
                      {processingStage === 'upload'
                        ? 'Securely uploading your audio file to storage...'
                        : 'Processing audio with advanced speech recognition. This may take a few minutes for longer recordings...'}
                    </p>
                  </div>
                )}

                {/* Success State */}
                {processingStage === 'complete' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      Audio uploaded and transcribed successfully! Fill in the details below to create the session.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Audio Player */}
                {audioUrl && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Audio Preview
                    </Label>
                    <audio src={audioUrl} controls className="w-full" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Metadata Form */}
        {processingStage === 'complete' && transcript && (
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>
                Provide information about this clinical session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patient-name">Patient Name *</Label>
                  <Input
                    id="patient-name"
                    value={metadata.patientName}
                    onChange={(e) => setMetadata({ ...metadata, patientName: e.target.value })}
                    placeholder="Enter patient name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointment-type">Appointment Type</Label>
                  <Input
                    id="appointment-type"
                    value={metadata.appointmentType}
                    onChange={(e) => setMetadata({ ...metadata, appointmentType: e.target.value })}
                    placeholder="e.g., consultation, follow-up"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={metadata.notes}
                  onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
                  placeholder="Any additional context or notes about this session"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Transcript Preview</Label>
                <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">
                    {transcript.substring(0, 500)}
                    {transcript.length > 500 && '...'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {transcript.split(' ').length} words • {Math.round(transcript.length / 5)} characters
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveSession} disabled={createSession.isPending} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {createSession.isPending ? 'Creating Session...' : 'Create Session'}
                </Button>
                <Button variant="outline" onClick={() => navigate('/sessions')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
