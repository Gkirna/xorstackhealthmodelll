import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Download, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportNote } from '@/lib/api';

interface ExportOptionsProps {
  sessionId: string;
  noteContent: string;
}

export function ExportOptions({ sessionId, noteContent }: ExportOptionsProps) {
  const [email, setEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleCopyToClipboard = async () => {
    try {
      const footer = '\n\n---\nAI-generated content. Verify accuracy before clinical use.';
      await navigator.clipboard.writeText(noteContent + footer);
      toast.success('Note copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true);
      console.log('Starting PDF export');
      const result = await exportNote(sessionId, 'pdf');
      console.log('Export completed');
      
      if (result.success && result.data?.url) {
        // Open in new tab for download
        window.open(result.data.url, '_blank');
        toast.success('Note exported as PDF');
      } else {
        const errorMsg = result.error?.message || 'Export failed';
        console.error('Export error:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('PDF export exception:', error);
      toast.error('Failed to export PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailExport = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setIsExporting(true);
      console.log('Starting email export to:', email);
      const result = await exportNote(sessionId, 'pdf', email);
      console.log('Email export result:', result);
      
      if (result.success) {
        toast.success(`Note sent to ${email}`);
        setEmail('');
      } else {
        const errorMsg = result.error?.message || 'Email failed';
        console.error('Email export error:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Email export exception:', error);
      toast.error('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export & Share</CardTitle>
        <CardDescription>Download or share the clinical note</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={handleCopyToClipboard}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy to Clipboard
        </Button>

        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={handleDownloadPDF}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>

        <div className="space-y-2">
          <Label htmlFor="email">Email Export</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button 
              onClick={handleEmailExport}
              disabled={isExporting || !email.trim()}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t">
          AI-generated content. Verify accuracy before clinical use.
        </p>
      </CardContent>
    </Card>
  );
}
