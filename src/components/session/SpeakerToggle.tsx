import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { User, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

interface SpeakerToggleProps {
  currentSpeaker: 'provider' | 'patient';
  onSpeakerChange: (speaker: 'provider' | 'patient') => void;
  isRecording: boolean;
}

export function SpeakerToggle({ currentSpeaker, onSpeakerChange, isRecording }: SpeakerToggleProps) {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    if (!isRecording) return;

    // Keyboard shortcut: Press 'S' to toggle speaker
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't toggle if typing in input/textarea
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        const newSpeaker = currentSpeaker === 'provider' ? 'patient' : 'provider';
        onSpeakerChange(newSpeaker);
        toast.success(`Now recording: ${newSpeaker === 'provider' ? 'Doctor' : 'Patient'}`, {
          duration: 1500
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSpeaker, onSpeakerChange, isRecording]);

  useEffect(() => {
    if (isRecording && showHint) {
      const timer = setTimeout(() => setShowHint(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [isRecording, showHint]);

  if (!isRecording) return null;

  const handleToggle = () => {
    const newSpeaker = currentSpeaker === 'provider' ? 'patient' : 'provider';
    onSpeakerChange(newSpeaker);
    toast.success(`Now recording: ${newSpeaker === 'provider' ? 'Doctor' : 'Patient'}`, {
      duration: 1500
    });
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 flex items-center gap-4">
        <div className="text-sm text-muted-foreground font-medium">
          Current Speaker:
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={currentSpeaker === 'provider' ? 'default' : 'outline'}
            size="lg"
            onClick={handleToggle}
            className="gap-2 min-w-[140px]"
          >
            <Stethoscope className="h-5 w-5" />
            Doctor
          </Button>
          
          <Button
            variant={currentSpeaker === 'patient' ? 'default' : 'outline'}
            size="lg"
            onClick={handleToggle}
            className="gap-2 min-w-[140px]"
          >
            <User className="h-5 w-5" />
            Patient
          </Button>
        </div>
      </div>
      
      {showHint && (
        <div className="bg-muted/80 backdrop-blur-sm text-muted-foreground text-xs px-3 py-1.5 rounded-md animate-in fade-in slide-in-from-bottom-2">
          Press <kbd className="px-1.5 py-0.5 bg-background rounded text-foreground font-mono">S</kbd> to toggle speaker
        </div>
      )}
    </div>
  );
}
