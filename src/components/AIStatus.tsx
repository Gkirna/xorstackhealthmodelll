import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AIOperation = 
  | 'generating-note'
  | 'extracting-tasks'
  | 'suggesting-codes'
  | 'summarizing'
  | 'processing'
  | 'idle';

export type AIStatus = 'idle' | 'processing' | 'success' | 'error';

interface AIStatusProps {
  operation: AIOperation;
  status: AIStatus;
  message?: string;
  progress?: number;
  className?: string;
}

const operationLabels: Record<AIOperation, string> = {
  'generating-note': 'Generating Clinical Note',
  'extracting-tasks': 'Extracting Follow-up Tasks',
  'suggesting-codes': 'Suggesting ICD-10 Codes',
  'summarizing': 'Summarizing Encounter',
  'processing': 'Processing',
  'idle': '',
};

const operationMessages: Record<AIOperation, string> = {
  'generating-note': 'AI is analyzing the transcript and creating a structured clinical note...',
  'extracting-tasks': 'Identifying actionable tasks from the clinical note...',
  'suggesting-codes': 'Analyzing diagnoses and suggesting appropriate ICD-10 codes...',
  'summarizing': 'Creating a concise summary of the clinical encounter...',
  'processing': 'Processing your request...',
  'idle': '',
};

export const AIStatus: React.FC<AIStatusProps> = ({
  operation,
  status,
  message,
  progress,
  className,
}) => {
  if (status === 'idle' && operation === 'idle') {
    return null;
  }

  const defaultMessage = operationMessages[operation] || message;
  const label = operationLabels[operation];

  return (
    <Card className={cn('p-4', className)}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {status === 'processing' && (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          
          <div className="flex-1">
            <h4 className="text-sm font-semibold">{label}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {defaultMessage}
            </p>
          </div>
        </div>

        {status === 'processing' && progress !== undefined && (
          <Progress value={progress} className="h-2" />
        )}
        
        {status === 'processing' && progress === undefined && (
          <Progress value={undefined} className="h-2" />
        )}
      </div>
    </Card>
  );
};

/**
 * Hook for managing AI operation status
 */
export function useAIStatus() {
  const [operation, setOperation] = React.useState<AIOperation>('idle');
  const [status, setStatus] = React.useState<AIStatus>('idle');
  const [message, setMessage] = React.useState<string>('');
  const [progress, setProgress] = React.useState<number | undefined>(undefined);

  const startOperation = (op: AIOperation, customMessage?: string) => {
    setOperation(op);
    setStatus('processing');
    setMessage(customMessage || '');
    setProgress(undefined);
  };

  const updateProgress = (value: number) => {
    setProgress(value);
  };

  const completeOperation = (successMessage?: string) => {
    setStatus('success');
    setMessage(successMessage || 'Operation completed successfully');
    setTimeout(() => {
      setOperation('idle');
      setStatus('idle');
      setMessage('');
      setProgress(undefined);
    }, 3000);
  };

  const failOperation = (errorMessage: string) => {
    setStatus('error');
    setMessage(errorMessage);
    setTimeout(() => {
      setOperation('idle');
      setStatus('idle');
      setMessage('');
      setProgress(undefined);
    }, 5000);
  };

  const reset = () => {
    setOperation('idle');
    setStatus('idle');
    setMessage('');
    setProgress(undefined);
  };

  return {
    operation,
    status,
    message,
    progress,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    reset,
  };
}
