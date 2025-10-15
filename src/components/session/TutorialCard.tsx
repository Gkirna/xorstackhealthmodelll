import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, BookOpen } from "lucide-react";

export function TutorialCard() {
  return (
    <Card className="w-[260px] p-4 space-y-4 border-border rounded-2xl bg-gradient-to-br from-primary/5 to-violet/5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-base text-foreground">Quick Tutorials</h3>
      </div>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm text-foreground">Getting Started</p>
          <Progress value={75} className="h-2" />
          <p className="text-xs text-muted-foreground">3 of 4 completed</p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start gap-2 rounded-xl"
        >
          <PlayCircle className="h-4 w-4" />
          <span className="text-sm">Continue Learning</span>
        </Button>
      </div>

      <div className="pt-2 border-t border-divider space-y-2">
        <button className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <p className="text-sm font-medium text-foreground">Recording Tips</p>
          <p className="text-xs text-muted-foreground">2 min read</p>
        </button>
        <button className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <p className="text-sm font-medium text-foreground">Using Templates</p>
          <p className="text-xs text-muted-foreground">3 min read</p>
        </button>
      </div>
    </Card>
  );
}
