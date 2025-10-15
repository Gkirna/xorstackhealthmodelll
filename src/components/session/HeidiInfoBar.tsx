import { useState } from "react";
import { Calendar, ChevronDown, Clock, Edit2, Mic } from "lucide-react";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

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
}: HeidiInfoBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(patientName);

  const handleNameSubmit = () => {
    onPatientNameChange(tempName);
    setIsEditingName(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 bg-card border-b border-border">
      {/* Left: Patient Name */}
      <div className="flex items-center gap-2">
        {isEditingName ? (
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
            className="text-[22px] font-bold h-10 w-64"
            autoFocus
          />
        ) : (
          <>
            <h1 className="text-[22px] font-bold text-foreground">
              {patientName || "New Patient"}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                setTempName(patientName);
                setIsEditingName(true);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Center: Date, Language, Microphone */}
      <div className="flex items-center gap-4">
        {/* Session Date/Time */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 text-[14px] text-muted-foreground hover:text-foreground"
            >
              <Calendar className="h-4 w-4" />
              {format(sessionDate, "PPP p")}
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

        {/* Language Selector */}
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[140px] h-9 text-[14px] border-b-2 border-t-0 border-x-0 rounded-none border-primary bg-transparent hover:bg-accent/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
          </SelectContent>
        </Select>

        {/* Microphone Selector */}
        <Select value={microphone} onValueChange={onMicrophoneChange}>
          <SelectTrigger className="w-[200px] h-9 text-[14px]">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="default">Default Microphone</SelectItem>
            <SelectItem value="headset">Headset Microphone</SelectItem>
            <SelectItem value="external">External USB Mic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Right: Timer */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-muted rounded-full">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-[14px] font-medium">{elapsedTime}</span>
      </div>
    </div>
  );
}
