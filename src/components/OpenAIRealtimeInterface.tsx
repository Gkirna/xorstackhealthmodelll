import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { OpenAIRealtimeChat } from '@/utils/OpenAIRealtimeChat';
import { Mic, MicOff, Radio, Brain, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface OpenAIRealtimeInterfaceProps {
  sessionId?: string;
  onTranscriptUpdate?: (text: string) => void;
  onAnalysisUpdate?: (analysis: any) => void;
}

export const OpenAIRealtimeInterface: React.FC<OpenAIRealtimeInterfaceProps> = ({
  sessionId,
  onTranscriptUpdate,
  onAnalysisUpdate,
}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const chatRef = useRef<OpenAIRealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('📩 Event:', event.type);
    
    switch (event.type) {
      case 'session.created':
        console.log('✅ Session created');
        break;
        
      case 'response.audio.delta':
        setIsSpeaking(true);
        break;
        
      case 'response.audio.done':
        setIsSpeaking(false);
        break;
        
      case 'response.audio_transcript.delta':
        const newText = currentTranscript + event.delta;
        setCurrentTranscript(newText);
        onTranscriptUpdate?.(newText);
        break;
        
      case 'response.audio_transcript.done':
        const finalTranscript = event.transcript;
        setMessages(prev => [...prev, { role: 'assistant', content: finalTranscript }]);
        setCurrentTranscript('');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = event.transcript;
        setMessages(prev => [...prev, { role: 'user', content: userTranscript }]);
        onTranscriptUpdate?.(userTranscript);
        break;
        
      case 'response.done':
        console.log('✅ Response completed');
        break;
        
      case 'error':
        console.error('❌ Error:', event.error);
        toast({
          title: "Error",
          description: event.error.message,
          variant: "destructive",
        });
        break;
    }
  };

  const startConversation = async () => {
    try {
      const instructions = `You are an advanced medical AI assistant integrated into a clinical documentation system.

Your capabilities:
- Real-time voice transcription with speaker identification
- Medical terminology recognition and entity extraction
- Clinical note generation in SOAP format
- ICD-10 code suggestions based on conversation
- Treatment plan recommendations
- Drug interaction checking

Guidelines:
- Be professional and HIPAA-compliant
- Ask clarifying questions when needed
- Provide accurate medical information
- Flag urgent or critical findings
- Maintain patient confidentiality
- Use medical terminology appropriately`;

      chatRef.current = new OpenAIRealtimeChat(handleMessage);
      await chatRef.current.init(instructions, "alloy");
      setIsConnected(true);
      
      toast({
        title: "🎙️ Connected",
        description: "OpenAI Realtime voice interface is ready",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    setCurrentTranscript('');
    
    toast({
      title: "Disconnected",
      description: "Realtime session ended",
    });
  };

  useEffect(() => {
    // Auto-start when component mounts
    startConversation();

    return () => {
      chatRef.current?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Live AI Assistant</h3>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Connecting..."}
            </Badge>
          </div>
        </div>

        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  repeat: isSpeaking ? Infinity : 0,
                  duration: 1,
                }}
              >
                {isSpeaking ? (
                  <Radio className="h-6 w-6 text-primary" />
                ) : (
                  <Mic className="h-6 w-6 text-muted-foreground" />
                )}
              </motion.div>
              
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {isSpeaking ? "AI is speaking..." : "Listening..."}
                </p>
                {currentTranscript && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentTranscript}
                  </p>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary/10 ml-8' 
                      : 'bg-muted mr-8'
                  }`}
                >
                  <p className="text-xs font-medium mb-1 text-muted-foreground">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </p>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
};
