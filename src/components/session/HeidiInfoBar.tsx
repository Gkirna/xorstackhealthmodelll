import { useState, useRef } from "react";
import { Calendar, Clock, Mic, Languages, ChevronDown, Check, Upload, Square, Play, Pause, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useAudioUpload } from "@/hooks/useAudioUpload";

interface HeidiInfoBarProps {
  patientName: string;
  onPatientNameChange: (name: string) => void;
  sessionDate: Date;
  onSessionDateChange: (date: Date) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  microphone: string;
  onMicrophoneChange: (mic: string) => void;
  elapsedTime: string;
  recordingMode: string;
  onRecordingModeChange: (mode: string) => void;
  sessionId?: string;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscriptChunk?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob, audioUrl?: string) => void;
}

export function HeidiInfoBar({
  patientName,
  onPatientNameChange,
  sessionDate,
  onSessionDateChange,
  language,
  onLanguageChange,
  microphone,
  onMicrophoneChange,
  elapsedTime,
  recordingMode,
  onRecordingModeChange,
  sessionId,
  onTranscriptUpdate,
  onFinalTranscriptChunk,
  onRecordingComplete,
}: HeidiInfoBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(patientName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameSubmit = () => {
    onPatientNameChange(tempName);
    setIsEditingName(false);
  };

  // Audio recording hook for dictating mode
  const {
    isRecording,
    isPaused,
    duration,
    isTranscribing,
    interimTranscript,
    transcriptSupported,
    error: recordingError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    formatDuration,
  } = useAudioRecording({
    onTranscriptUpdate,
    onFinalTranscriptChunk,
    onRecordingComplete,
  });

  // Audio upload hook for upload mode
  const {
    isUploading,
    uploadProgress,
    error: uploadError,
    uploadedFile,
    audioUrl,
    uploadAudio,
    removeAudio,
    formatFileSize,
    validateFile,
  } = useAudioUpload({
    sessionId,
    onTranscriptGenerated: onFinalTranscriptChunk,
    onAudioUploaded: (url) => console.log("Audio uploaded:", url),
  });

  const handleModeChange = (mode: string) => {
    // Stop any active recording when switching modes
    if (isRecording) {
      stopRecording();
    }
    onRecordingModeChange(mode);
  };

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      return;
    }
    await uploadAudio(file);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="infobar flex items-center justify-between px-6 py-3 rounded-xl shadow-sm bg-card gap-4 sm:gap-6">
      {/* Left: inline items with separators */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="items-center p-1 px-0 flex h-10 shrink-0 flex-row justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent flex-1 tabs-list-scrollbar"
      >
        {/* Patient name (editable) */}
        <span className="flex items-center gap-x-1">
          {isEditingName ? (
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
              className="h-8 sm:h-10 w-48 sm:w-64 text-sm sm:text-base font-semibold text-gray-800"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="justify-center whitespace-nowrap text-sm font-medium transition-all group flex items-center gap-x-1 rounded-sm border border-transparent px-2 py-1 text-text-secondary hover:border hover:border-outline"
              onClick={() => {
                setTempName(patientName);
                setIsEditingName(true);
              }}
              aria-label="Edit patient name"
            >
              <p className="text-sm font-medium text-gray-800">{patientName || "New Patient"}</p>
              <span className="text-sm text-gray-500 group-hover:text-gray-700">✏️</span>
            </button>
          )}
          <div role="none" className="shrink-0 bg-border w-px h-6" />
        </span>

        {/* Date */}
        <span className="flex items-center gap-x-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="group flex items-center gap-1.5 rounded-sm px-1.5 pb-1.5 pt-1 text-[0.875rem] leading-[150%] transition hover:bg-background-secondary text-text-secondary"
              >
                <Calendar className="h-4 w-4 text-text-secondary" />
                <span className="border-b border-dashed border-text-tertiary">
                  {format(sessionDate, "MMM do h:mmaaa")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={sessionDate}
                onSelect={(date) => date && onSessionDateChange(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <div role="none" className="shrink-0 bg-border w-px h-6" />
        </span>

        {/* Language */}
        <span className="flex items-center gap-x-1">
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="group flex items-center gap-1.5 rounded-sm px-1.5 pb-1.5 pt-1 text-[0.875rem] leading-[150%] transition bg-transparent hover:bg-background-secondary text-text-secondary min-w-[110px] h-8 border border-transparent">
              <Languages className="size-4 text-text-secondary" />
              <span className="border-b border-dashed border-text-tertiary">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
          <div role="none" className="shrink-0 bg-border w-px h-6" />
        </span>

        {/* Microphone */}
        <span className="flex items-center gap-x-1">
          <Select value={microphone} onValueChange={onMicrophoneChange}>
            <SelectTrigger className="h-10 items-center justify-between rounded-md text-sm outline-none transition-all duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-secondary [&>span]:line-clamp-1 flex !h-auto w-auto gap-1 border bg-transparent p-1 border-transparent">
              <div className="overflow-hidden">
                <Mic className="text-text-secondary" size={20} />
              </div>
              <div className="ml-auto flex h-5 w-11 items-center justify-around gap-0.5 overflow-hidden px-1 py-px">
                <div className="max-h-5 min-h-2 w-1 flex-1 rounded-full bg-green-500" style={{height: '7.5px'}} />
                <div className="max-h-5 min-h-2 w-1 flex-1 rounded-full bg-green-500" style={{height: '7.5px'}} />
                <div className="max-h-5 min-h-2 w-1 flex-1 rounded-full bg-green-500" style={{height: '9px'}} />
                <div className="max-h-5 min-h-2 w-1 flex-1 rounded-full bg-green-500" style={{height: '7.5px'}} />
                <div className="max-h-5 min-h-2 w-1 flex-1 rounded-full bg-green-500" style={{height: '7.5px'}} />
              </div>
              <span className="hidden md:inline max-w-36 truncate text-text-secondary text-sm">
                <SelectValue placeholder="Default Microphone" />
              </span>
              <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="default">Default Microphone</SelectItem>
              <SelectItem value="headset">Headset Microphone</SelectItem>
              <SelectItem value="external">External USB Mic</SelectItem>
            </SelectContent>
          </Select>
          <div role="none" className="shrink-0 bg-border w-px h-6" />
        </span>

        {/* Timer */}
        <span className="flex items-center gap-x-1">
          <div className="group flex items-center gap-x-1 rounded-sm border border-transparent px-2 py-1">
            <div className="flex items-center gap-2 h-8 px-3 bg-gray-100 rounded-full">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-mono text-xs sm:text-sm font-medium text-gray-700">{elapsedTime}</span>
            </div>
          </div>
          <div role="none" className="shrink-0 bg-border w-px h-6" />
        </span>

      </div>

      {/* Right: recording dropdown aligned to end */}
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 h-8 rounded-sm flex items-center gap-2 text-sm font-medium">
              <Mic className="h-4 w-4" />
              {recordingMode === 'transcribing' && 'Start transcribing'}
              {recordingMode === 'dictating' && (isRecording ? 'Dictating...' : 'Start dictating')}
              {recordingMode === 'upload' && 'Upload audio'}
              <div className="w-px h-4 bg-white/20" />
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-0">
            <div className="bg-green-600 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="font-semibold">
                {recordingMode === 'transcribing' && 'Start transcribing'}
                {recordingMode === 'dictating' && 'Start dictating'}
                {recordingMode === 'upload' && 'Upload audio'}
              </span>
              <div className="w-px h-4 bg-white/20 ml-auto" />
              <ChevronDown className="h-4 w-4" />
            </div>

            {/* Mode Selection */}
            <div className="py-1 border-b">
              <DropdownMenuItem className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => handleModeChange('transcribing')}>
                <span className="text-sm">Transcribing</span>
                {recordingMode === 'transcribing' && <Check className="h-4 w-4 text-blue-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => handleModeChange('dictating')}>
                <span className="text-sm">Dictating</span>
                {recordingMode === 'dictating' && <Check className="h-4 w-4 text-blue-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => handleModeChange('upload')}>
                <span className="text-sm">Upload session audio</span>
                {recordingMode === 'upload' && <Check className="h-4 w-4 text-blue-600" />}
              </DropdownMenuItem>
            </div>

            {/* Recording Controls */}
            {recordingMode === 'transcribing' && (
              <div className="py-2 px-3">
                <p className="text-xs text-gray-500 mb-2">Basic speech-to-text transcription</p>
                <Button size="sm" className="w-full" onClick={() => { if (onTranscriptUpdate) { onTranscriptUpdate('Transcribing mode activated', false); } }}>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Basic Transcription
                </Button>
              </div>
            )}

            {recordingMode === 'dictating' && (
              <div className="py-2 px-3">
                <p className="text-xs text-gray-500 mb-2">Real-time dictation with controls</p>
                <div className="flex items-center gap-2 mb-2">
                  {isRecording && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                  <span className="text-sm font-mono">{formatDuration(duration)}</span>
                  {isTranscribing && <Zap className="h-3 w-3 text-green-500" />}
                </div>
                <div className="flex gap-2">
                  {!isRecording ? (
                    <Button size="sm" onClick={startRecording} disabled={!transcriptSupported} className="flex-1">
                      <Mic className="h-4 w-4 mr-2" />
                      Start Dictating
                    </Button>
                  ) : (
                    <>
                      {isPaused ? (
                        <Button size="sm" variant="secondary" onClick={resumeRecording} className="flex-1">
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={pauseRecording} className="flex-1">
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={stopRecording} className="flex-1">
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>
                {interimTranscript && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <strong>Live:</strong> {interimTranscript}
                  </div>
                )}
              </div>
            )}

            {recordingMode === 'upload' && (
              <div className="py-2 px-3">
                <p className="text-xs text-gray-500 mb-2">Upload audio files (.mp3, .wav, .m4a)</p>
                {!uploadedFile ? (
                  <div className="space-y-2">
                    <Button size="sm" variant="outline" onClick={openFileDialog} disabled={isUploading} className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.webm" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} className="hidden" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">{uploadedFile.name}</span>
                      <Button size="sm" variant="ghost" onClick={removeAudio} className="h-6 w-6 p-0">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {isUploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div className="bg-green-600 h-1 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}
                    {audioUrl && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        Upload complete
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
