import { useState } from "react";
import { Mic, Send, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AskHeidiBarProps {
  onSendMessage?: (message: string) => void;
}

export function AskHeidiBar({ onSendMessage }: AskHeidiBarProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background px-6 py-4">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <span className="text-xs font-bold text-white">H</span>
          </div>
        </Button>
        
        <div className="flex-1 relative">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Heidi to do anything..."
            className="pr-20 h-10"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim()}
              size="icon"
              className="h-7 w-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
