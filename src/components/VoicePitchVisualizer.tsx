import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface VoiceCharacteristics {
  gender: 'male' | 'female' | 'unknown';
  pitch: number;
  confidence: number;
  speakerId: string;
  voiceQuality: string;
  volume: number;
}

interface VoicePitchVisualizerProps {
  characteristics: VoiceCharacteristics | null;
  isRecording: boolean;
}

export function VoicePitchVisualizer({ characteristics, isRecording }: VoicePitchVisualizerProps) {
  const [history, setHistory] = useState<number[]>([]);
  
  useEffect(() => {
    if (characteristics && characteristics.pitch > 0) {
      setHistory(prev => [...prev.slice(-20), characteristics.pitch]);
    }
  }, [characteristics]);
  
  if (!isRecording || !characteristics) return null;
  
  const speakerColor = characteristics.speakerId.includes('speaker_1') 
    ? 'bg-blue-500' 
    : 'bg-green-500';
  
  const speakerLabel = characteristics.speakerId.includes('speaker_1') ? 'Provider' : 'Patient';
  
  return (
    <Card className="p-3 space-y-2 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Voice Analysis</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${speakerColor} text-white border-0`}>
          {speakerLabel}
        </Badge>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Pitch</span>
          <span className="font-mono">{characteristics.pitch.toFixed(0)} Hz</span>
        </div>
        <Progress value={(characteristics.pitch / 500) * 100} className="h-1.5" />
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Confidence</span>
          <span className="font-mono">{(characteristics.confidence * 100).toFixed(0)}%</span>
        </div>
        <Progress value={characteristics.confidence * 100} className="h-1.5" />
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Quality</span>
          <span className="capitalize font-mono">{characteristics.voiceQuality}</span>
        </div>
      </div>
      
      {/* Mini waveform showing pitch history */}
      <div className="flex items-end gap-0.5 h-8 pt-1 border-t border-border/50">
        {history.map((pitch, i) => (
          <div
            key={i}
            className={`flex-1 ${speakerColor} rounded-t transition-all duration-200`}
            style={{ height: `${Math.min(100, (pitch / 500) * 100)}%`, minHeight: '4px' }}
          />
        ))}
      </div>
    </Card>
  );
}
