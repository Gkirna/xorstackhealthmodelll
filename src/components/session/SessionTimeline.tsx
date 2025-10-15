import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: string;
  date: string;
  time: string;
  title: string;
  completed: boolean;
}

export function SessionTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([
    { id: "1", date: "Today", time: "10:30 AM", title: "Patient Check-in", completed: true },
    { id: "2", date: "Today", time: "10:35 AM", title: "Vital Signs", completed: true },
    { id: "3", date: "Today", time: "10:40 AM", title: "Chief Complaint", completed: false },
    { id: "4", date: "Today", time: "10:45 AM", title: "Examination", completed: false },
  ]);

  const toggleItem = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  return (
    <Card className="w-[280px] p-4 space-y-3 border-border rounded-2xl">
      <h3 className="font-semibold text-base text-foreground">Session Timeline</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer hover:bg-muted/50",
              item.completed && "opacity-60"
            )}
            onClick={() => toggleItem(item.id)}
          >
            <Checkbox
              checked={item.completed}
              className="h-4 w-4"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
