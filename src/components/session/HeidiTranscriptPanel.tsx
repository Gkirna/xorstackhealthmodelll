import { useState } from "react";
import { Mic, Square, Upload, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioRecorderWithTranscription } from "@/components/AudioRecorderWithTranscription";
import { AudioUploadTranscription } from "@/components/AudioUploadTranscription";

interface HeidiTranscriptPanelProps {
  sessionId?: string;
  transcript: string;
  onTranscriptChange: (text: string) => void;
  onTranscriptChunk: (text: string) => void;
  onRecordingComplete: (blob: Blob, url?: string) => void;
}

export function HeidiTranscriptPanel({
  sessionId,
  transcript,
  onTranscriptChange,
  onTranscriptChunk,
  onRecordingComplete,
}: HeidiTranscriptPanelProps) {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <Card className="p-6 rounded-3xl border-2">
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="record" className="text-[14px]">
              <Mic className="h-4 w-4 mr-2" />
              Live Recording
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-[14px]">
              <Upload className="h-4 w-4 mr-2" />
              Upload Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="mt-0">
            {sessionId && (
              <AudioRecorderWithTranscription
                sessionId={sessionId}
                onTranscriptUpdate={(text, isFinal) => {
                  if (!isFinal) {
                    // Preview interim results
                  }
                }}
                onFinalTranscriptChunk={onTranscriptChunk}
                onRecordingComplete={onRecordingComplete}
              />
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-0">
            {sessionId && (
              <AudioUploadTranscription
                sessionId={sessionId}
                onTranscriptGenerated={onTranscriptChunk}
                onAudioUploaded={(url) => console.log("Audio uploaded:", url)}
              />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Transcript Display */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">Live Transcript</h3>
            {transcript && (
              <span className="text-[12px] text-muted-foreground">
                {transcript.split(" ").length} words
              </span>
            )}
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder="Start recording or type manually..."
            className="min-h-[300px] text-[16px] leading-relaxed resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </Card>
    </div>
  );
}
