import { useState, useRef, useEffect } from "react";
import { Mic, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AskHeidiBarProps {
  sessionId?: string;
  transcript?: string;
  context?: string;
}

export function AskHeidiBar({ sessionId, transcript, context }: AskHeidiBarProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    try {
      const contextInfo = [transcript, context].filter(Boolean).join('\n\n');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-heidi-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          message: userMessage,
          context: contextInfo 
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          return;
        }
        if (response.status === 402) {
          toast.error("Payment required. Please add funds to your workspace.");
          return;
        }
        throw new Error('Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let line of lines) {
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantMessage } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantMessage }];
              });
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      toast.error('Failed to get response from Heidi');
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message;
    setMessage("");
    setIsLoading(true);
    setShowChat(true);

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    await streamChat(userMessage);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Header + Messages */}
      {messages.length > 0 && (
        <div className="px-6 pt-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Heidi conversation</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowChat((v) => !v)}
              >
                {showChat ? 'Hide chat' : `Show chat (${messages.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showChat && messages.length > 0 && (
        <div className="px-6 pb-2">
          <div className="max-w-4xl mx-auto space-y-3 rounded-md border bg-background p-3 max-h-[50vh] overflow-y-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/20 border'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="bg-background px-6 py-3">
        <div className="flex min-h-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 sm:min-h-[52px] max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">H</span>
            </div>
          </Button>

          <div className="flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Heidi to do anything..."
              className="h-10 sm:h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-1 self-end sm:mb-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isLoading}
              size="icon"
              className="h-7 w-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
