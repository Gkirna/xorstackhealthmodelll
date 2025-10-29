import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { OpenAIRealtimeChat } from '@/utils/OpenAIRealtimeChat';
import { Mic, MicOff, Radio, Brain, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import { supabase } from '@/integrations/supabase/client';

interface OpenAIRealtimeInterfaceProps {
  sessionId?: string;
  onTranscriptUpdate?: (text: string) => void;
  onAnalysisUpdate?: (analysis: any) => void;
  onNoteUpdate?: (note: string, noteJson: any) => void;
}

export const OpenAIRealtimeInterface: React.FC<OpenAIRealtimeInterfaceProps> = ({
  sessionId,
  onTranscriptUpdate,
  onAnalysisUpdate,
  onNoteUpdate,
}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [clinicalNote, setClinicalNote] = useState<any>(null);
  const [fullConversation, setFullConversation] = useState('');
  const chatRef = useRef<OpenAIRealtimeChat | null>(null);

  const generateClinicalNote = async (conversation: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gpt5-medical-analysis', {
        body: { 
          transcript: conversation,
          analysis_type: 'soap_note'
        }
      });

      if (error) throw error;

      if (data?.success && data?.analysis) {
        setClinicalNote(data.analysis);
        
        // Format as readable SOAP note
        const soapNote = formatSOAPNote(data.analysis);
        onNoteUpdate?.(soapNote, data.analysis);
        
        // Update session in database
        if (sessionId) {
          await supabase
            .from('sessions')
            .update({ 
              generated_note: soapNote,
              note_json: data.analysis
            })
            .eq('id', sessionId);
        }
      }
    } catch (error) {
      console.error('Error generating clinical note:', error);
    }
  };

  const formatSOAPNote = (analysis: any) => {
    const soap = analysis.soap_note || analysis;
    
    let formatted = '';
    
    if (soap.subjective) {
      formatted += '**SUBJECTIVE**\n\n';
      formatted += typeof soap.subjective === 'string' 
        ? soap.subjective 
        : JSON.stringify(soap.subjective, null, 2);
      formatted += '\n\n';
    }
    
    if (soap.objective) {
      formatted += '**OBJECTIVE**\n\n';
      if (soap.vital_signs) {
        formatted += 'Vital Signs:\n';
        Object.entries(soap.vital_signs).forEach(([key, value]) => {
          formatted += `  - ${key}: ${value}\n`;
        });
        formatted += '\n';
      }
      if (soap.physical_exam) {
        formatted += 'Physical Exam:\n' + soap.physical_exam + '\n\n';
      }
    }
    
    if (soap.assessment) {
      formatted += '**ASSESSMENT**\n\n';
      formatted += typeof soap.assessment === 'string'
        ? soap.assessment
        : JSON.stringify(soap.assessment, null, 2);
      formatted += '\n\n';
      
      if (soap.icd10_codes && soap.icd10_codes.length > 0) {
        formatted += 'ICD-10 Codes:\n';
        soap.icd10_codes.forEach((code: any) => {
          formatted += `  - ${code.code}: ${code.description}\n`;
        });
        formatted += '\n';
      }
    }
    
    if (soap.plan) {
      formatted += '**PLAN**\n\n';
      formatted += typeof soap.plan === 'string'
        ? soap.plan
        : JSON.stringify(soap.plan, null, 2);
      formatted += '\n\n';
      
      if (soap.medications && soap.medications.length > 0) {
        formatted += 'Medications:\n';
        soap.medications.forEach((med: any) => {
          formatted += `  - ${med.name || med}: ${med.dosage || ''} ${med.frequency || ''}\n`;
        });
        formatted += '\n';
      }
      
      if (soap.follow_up) {
        formatted += 'Follow-up: ' + soap.follow_up + '\n';
      }
    }
    
    return formatted.trim();
  };

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
        
        // Update full conversation and generate note
        const updatedConversation = fullConversation + '\n\nAI Assistant: ' + finalTranscript;
        setFullConversation(updatedConversation);
        
        // Generate clinical note after each AI response
        if (updatedConversation.length > 100) {
          generateClinicalNote(updatedConversation);
        }
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = event.transcript;
        setMessages(prev => [...prev, { role: 'user', content: userTranscript }]);
        onTranscriptUpdate?.(userTranscript);
        
        // Update full conversation
        setFullConversation(prev => prev + '\n\nPatient/Provider: ' + userTranscript);
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
      const instructions = `You are an advanced medical AI assistant conducting a live clinical interview.

Your role:
- Listen actively to the patient-provider conversation
- Ask relevant follow-up questions about symptoms, history, medications
- Help document the encounter in real-time
- Extract key clinical information: chief complaint, HPI, past medical history, medications, allergies
- Note vital signs, physical exam findings, and assessment
- Suggest appropriate treatment plans

After gathering sufficient information, you will help generate a complete SOAP note.

Guidelines:
- Be conversational and empathetic
- Ask one question at a time
- Clarify unclear information
- Use medical terminology appropriately
- Maintain HIPAA compliance
- Be thorough but efficient

Start by asking about the chief complaint and reason for visit.`;

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

            {/* Clinical Note Preview */}
            {clinicalNote && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generated Clinical Note
                </h4>
                <div className="text-sm space-y-2 max-h-[300px] overflow-y-auto">
                  {clinicalNote.soap_note && (
                    <div className="space-y-3">
                      {clinicalNote.soap_note.subjective && (
                        <div>
                          <p className="font-semibold text-primary">SUBJECTIVE</p>
                          <p className="text-muted-foreground mt-1">{clinicalNote.soap_note.subjective}</p>
                        </div>
                      )}
                      {clinicalNote.soap_note.objective && (
                        <div>
                          <p className="font-semibold text-primary">OBJECTIVE</p>
                          <p className="text-muted-foreground mt-1">{clinicalNote.soap_note.objective}</p>
                        </div>
                      )}
                      {clinicalNote.soap_note.assessment && (
                        <div>
                          <p className="font-semibold text-primary">ASSESSMENT</p>
                          <p className="text-muted-foreground mt-1">{clinicalNote.soap_note.assessment}</p>
                          {clinicalNote.soap_note.icd10_codes && clinicalNote.soap_note.icd10_codes.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium">ICD-10 Codes:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {clinicalNote.soap_note.icd10_codes.map((code: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {code.code}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {clinicalNote.soap_note.plan && (
                        <div>
                          <p className="font-semibold text-primary">PLAN</p>
                          <p className="text-muted-foreground mt-1">{clinicalNote.soap_note.plan}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Conversation History */}
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
