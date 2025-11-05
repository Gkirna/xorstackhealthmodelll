import { cn } from "@/lib/utils";

interface AudioLevelIndicatorProps {
  level: number; // 0-100
  className?: string;
}

export function AudioLevelIndicator({ level, className }: AudioLevelIndicatorProps) {
  const bars = 10;
  const activeBars = Math.ceil((level / 100) * bars);
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground mr-2">Audio Level:</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => {
          const isActive = i < activeBars;
          const barColor = 
            i < 3 ? 'bg-green-500' : 
            i < 7 ? 'bg-yellow-500' : 
            'bg-red-500';
          
          return (
            <div
              key={i}
              className={cn(
                "w-1.5 h-4 rounded-sm transition-all duration-100",
                isActive ? barColor : "bg-muted",
                isActive && "shadow-sm"
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-mono ml-2 text-muted-foreground">
        {Math.round(level)}%
      </span>
    </div>
  );
}
