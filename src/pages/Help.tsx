import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Keyboard, MessageCircle, ExternalLink, Video, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import { useState, useEffect } from "react";

const Help = () => {
  const { toast } = useToast();
  const submitFeedback = useSubmitFeedback();
  const [draftFeedback, setDraftFeedback] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  // Persist draft feedback in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('draftFeedback');
    if (saved) {
      setDraftFeedback(JSON.parse(saved));
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    const updated = { ...draftFeedback, [field]: value };
    setDraftFeedback(updated);
    localStorage.setItem('draftFeedback', JSON.stringify(updated));
  };

  const handleContactSupport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await submitFeedback.mutateAsync({
      title: formData.get("subject") as string,
      description: formData.get("message") as string,
      feedback_type: 'support',
      metadata: {
        name: formData.get("name") as string,
        email: formData.get("email") as string,
      }
    });

    // Clear draft
    setDraftFeedback({ name: '', email: '', subject: '', message: '' });
    localStorage.removeItem('draftFeedback');
    
    toast({
      title: "Message sent",
      description: "Our support team will get back to you soon",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Help & Support</h1>
          <p className="text-muted-foreground">Get help and learn how to use Xorstack Health Model</p>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Getting Started
            </CardTitle>
            <CardDescription>Quick start guides and tutorials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Video Tutorial: Your First Session</h4>
                    <p className="text-sm text-muted-foreground">Learn how to record and document your first clinical encounter</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Quick Start Guide</h4>
                    <p className="text-sm text-muted-foreground">Step-by-step walkthrough of core features</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Template Customization</h4>
                    <p className="text-sm text-muted-foreground">Create and manage your documentation templates</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Team Collaboration</h4>
                    <p className="text-sm text-muted-foreground">Set up teams and manage permissions</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription>Speed up your workflow with these shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">New Session</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + N</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Start/Stop Recording</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + R</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Generate Note</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + G</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Copy Note</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + C</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Export as PDF</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + E</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Search</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">Ctrl/Cmd + K</kbd>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Open Help</span>
                <kbd className="px-2 py-1 text-sm bg-muted rounded">F1</kbd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>Common questions and answers</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>How do I record a clinical session?</AccordionTrigger>
                <AccordionContent>
                  To record a session, click "New Session" from the dashboard or sidebar. Fill in the patient information, then click "Start Session" to begin recording. You can type notes directly or use voice recording if your device supports it.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>How does AI note generation work?</AccordionTrigger>
                <AccordionContent>
                  During your session recording, our AI analyzes the conversation and clinical context in real-time. When you click "Generate Note", it creates a structured clinical note following your selected template (SOAP, H&P, etc.) with relevant medical terminology and ICD-10 codes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I customize note templates?</AccordionTrigger>
                <AccordionContent>
                  Yes! Go to Templates in the sidebar to create custom templates. You can define sections, fields, and formatting that match your specialty and workflow. Templates can be saved for personal use or shared with your team.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Is my patient data secure?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. We use end-to-end encryption, comply with HIPAA regulations, and store all data in secure, SOC 2 certified data centers. Your patient information is never shared with third parties, and you maintain full control over your data.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>How do I export my notes?</AccordionTrigger>
                <AccordionContent>
                  From the session review page, you can export notes in multiple formats: copy to clipboard, download as PDF or DOCX, or send directly via email. You can also export all your sessions in bulk from Settings → Data Management.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>Can I integrate with my EMR system?</AccordionTrigger>
                <AccordionContent>
                  We support integrations with major EMR systems including Epic, Athena Health, and Cerner. Go to Settings → Integrations to connect your EMR. Note: EMR integration requires a Professional or Enterprise plan.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Contact Support
            </CardTitle>
            <CardDescription>Can't find what you're looking for? Send us a message</CardDescription>
          </CardHeader>
          <CardContent>
              <form onSubmit={handleContactSupport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="Your name" 
                    value={draftFeedback.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="your@email.com"
                    value={draftFeedback.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input 
                  id="subject" 
                  name="subject" 
                  placeholder="How can we help?"
                  value={draftFeedback.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Describe your issue or question"
                  rows={5}
                  value={draftFeedback.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={submitFeedback.isPending}>
                {submitFeedback.isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Feature Request */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Requests</CardTitle>
            <CardDescription>Help us improve by suggesting new features</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Submit Feature Request
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Help;
