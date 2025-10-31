import { Trash2, Calendar, Languages, Clock, Mic, ChevronDown, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface SessionTopBarProps {
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
  onStartRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
  isPaused?: boolean;
  isStartingRecording?: boolean;
}

export function SessionTopBar({
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
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  isRecording = false,
  isPaused = false,
  isStartingRecording = false,
}: SessionTopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(patientName);

  const handleNameSubmit = () => {
    onPatientNameChange(tempName);
    setIsEditingName(false);
  };

  return (
    <div className="border-b bg-background">
      {/* First Row: Add patient details + Start button */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1">
          {isEditingName ? (
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
              className="h-9 w-72 text-xl sm:text-2xl font-semibold"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setTempName(patientName);
                setIsEditingName(true);
              }}
              className="flex items-center gap-2 text-xl sm:text-2xl font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span>{patientName || "Add patient details"}</span>
            </button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Recording state: Show Pause + Stop buttons */}
          {isRecording && !isPaused && (
            <>
              <Button
                onClick={onPauseRecording}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                onClick={onStopRecording}
                variant="destructive"
                className="px-4 py-2 h-9 flex items-center gap-2"
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                Stop transcribing
              </Button>
            </>
          )}

          {/* Paused state: Show filled Square + Resume buttons */}
          {isRecording && isPaused && (
            <>
              <Button
                onClick={onStopRecording}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
              <Button
                onClick={onResumeRecording}
                variant="success"
                className="px-4 py-2 h-9 flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                Resume transcribing
              </Button>
            </>
          )}

          {/* Not recording: Show Start button with dropdown */}
          {!isRecording && (
            <>
              <Button 
                onClick={onStartRecording} 
                disabled={isStartingRecording}
                variant="success"
                className="px-4 py-2 h-9 rounded-r-none flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                {isStartingRecording 
                  ? 'Starting...'
                  : (recordingMode === 'transcribing' ? 'Start transcribing' : 
                     recordingMode === 'dictating' ? 'Start dictating' : 
                     recordingMode === 'upload' ? 'Upload session audio' : 'Start transcribing')
                }
              </Button>

              {/* Chevron Down Dropdown - Mode Selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    disabled={isStartingRecording}
                    variant="success"
                    className="px-2 h-9 rounded-l-none border-l border-white/20"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => onRecordingModeChange('transcribing')}
                    className="flex items-center justify-between"
                  >
                    <span>Transcribing</span>
                    {recordingMode === 'transcribing' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onRecordingModeChange('dictating')}
                    className="flex items-center justify-between"
                  >
                    <span>Dictating</span>
                    {recordingMode === 'dictating' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onRecordingModeChange('upload')}
                    className="flex items-center justify-between"
                  >
                    <span>Upload session audio</span>
                    {recordingMode === 'upload' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Second Row: Date, Language, Badge, Timer, Mic */}
      <div className="flex items-center justify-between px-6 py-1">
        <div className="flex items-center gap-2">
          {/* Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-8 px-2 text-sm text-muted-foreground hover:text-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(sessionDate, "EEEE hh:mmaaa")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={sessionDate}
                onSelect={(date) => date && onSessionDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Language */}
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent hover:bg-accent text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono">{elapsedTime}</span>
          </div>

          {/* Microphone with level bars */}
          <Select value={microphone} onValueChange={onMicrophoneChange}>
            <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent hover:bg-accent">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-green-500"
                      style={{ height: `${8 + Math.random() * 4}px` }}
                    />
                  ))}
                </div>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Microphone</SelectItem>
              <SelectItem value="headset">Headset Microphone</SelectItem>
              <SelectItem value="external">External USB Mic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
