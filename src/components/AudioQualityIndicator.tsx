import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, WifiOff } from "lucide-react";

interface AudioQualityIndicatorProps {
  volume: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  isActive: boolean;
  mode: 'direct' | 'playback';
}

export function AudioQualityIndicator({ volume, quality, isActive, mode }: AudioQualityIndicatorProps) {
  const getQualityColor = () => {
    if (!isActive) return 'text-muted-foreground';
    switch (quality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getQualityIcon = () => {
    if (!isActive) return <WifiOff className="w-4 h-4" />;
    if (quality === 'excellent' || quality === 'good') {
      return <CheckCircle className="w-4 h-4" />;
    }
    return <AlertCircle className="w-4 h-4" />;
  };

  const getQualityMessage = () => {
    if (!isActive) return 'No audio detected';
    if (mode === 'playback') {
      switch (quality) {
        case 'poor':
          return 'Low quality - move closer or increase volume';
        case 'fair':
          return 'Fair quality - consider adjusting speaker position';
        case 'good':
          return 'Good quality - transcription active';
        case 'excellent':
          return 'Excellent quality - optimal transcription';
      }
    } else {
      switch (quality) {
        case 'poor':
          return 'Low quality - speak closer to microphone';
        case 'fair':
          return 'Fair quality - reduce background noise';
        case 'good':
          return 'Good quality - transcription active';
        case 'excellent':
          return 'Excellent quality - optimal transcription';
      }
    }
  };

  return (
    <Card className="p-3 bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={getQualityColor()}>
          {getQualityIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Audio Quality</span>
            <span className={`text-xs font-medium ${getQualityColor()}`}>
              {isActive ? quality.toUpperCase() : 'INACTIVE'}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                quality === 'excellent' ? 'bg-green-500' :
                quality === 'good' ? 'bg-blue-500' :
                quality === 'fair' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, volume)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{getQualityMessage()}</p>
        </div>
      </div>
    </Card>
  );
}
