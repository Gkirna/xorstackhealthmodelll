import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { askHeidiAssistant } from '@/ai/heidiBrain';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AskHeidiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session_id?: string;
}

export const AskHeidiDrawer: React.FC<AskHeidiDrawerProps> = ({
  open,
  onOpenChange,
  session_id,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await askHeidiAssistant(
        userMessage.content,
        session_id
      );

      if (result.success && result.answer) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: result.answer,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (result.warnings && result.warnings.length > 0) {
          console.warn('Heidi warnings:', result.warnings);
        }
      } else {
        throw new Error(result.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error asking Heidi:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get response from Heidi',
        variant: 'destructive',
      });

      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Heidi
          </SheetTitle>
          <SheetDescription>
            Your AI medical assistant. Ask questions about this session or general clinical topics.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-12rem)] mt-6">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Ask me anything about this clinical session</p>
                  <p className="text-xs mt-2">I have access to the patient context and clinical notes</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Heidi is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="mt-4 flex gap-2">
            <Textarea
              placeholder="Ask Heidi a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="min-h-[80px]"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-[80px] w-12"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
