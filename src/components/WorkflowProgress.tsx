import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, XCircle, AlertCircle } from 'lucide-react';
import type { WorkflowState } from '@/utils/WorkflowOrchestrator';

interface WorkflowProgressProps {
  state: WorkflowState;
}

export function WorkflowProgress({ state }: WorkflowProgressProps) {
  if (!state.isRunning && state.steps.every(s => s.status === 'pending')) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {state.isRunning && <Loader2 className="h-5 w-5 animate-spin" />}
          {state.isRunning ? 'Generating note…' : 'AI Workflow Pipeline'}
        </CardTitle>
        <CardDescription>
          {state.isRunning
            ? `Processing step ${state.currentStep + 1} of ${state.steps.length}`
            : 'Automated processing of your clinical documentation'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.steps.map((step, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step.status === 'completed' && (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                )}
                {step.status === 'in-progress' && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {step.status === 'pending' && (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                
                <span className={`font-medium ${
                  step.status === 'completed' ? 'text-success' :
                  step.status === 'in-progress' ? 'text-primary' :
                  step.status === 'failed' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {step.name}
                </span>
              </div>
              
              <Badge 
                variant={
                  step.status === 'completed' ? 'default' :
                  step.status === 'in-progress' ? 'secondary' :
                  step.status === 'failed' ? 'destructive' :
                  'outline'
                }
              >
                {step.status === 'pending' && 'Waiting'}
                {step.status === 'in-progress' && `${step.progress}%`}
                {step.status === 'completed' && 'Done'}
                {step.status === 'failed' && 'Failed'}
              </Badge>
            </div>
            
            <div className="pl-7 space-y-1">
              <p className="text-sm text-muted-foreground">{step.message}</p>
              
              {step.status === 'in-progress' && (
                <Progress value={step.progress} className="h-1" />
              )}
              
              {step.error && (
                <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{step.error}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {state.isRunning && (
          <div className="pt-4 border-t">
            <p className="text-sm text-center text-muted-foreground">
              Processing step {state.currentStep + 1} of {state.steps.length}...
            </p>
          </div>
        )}
        
        {!state.isRunning && state.steps.some(s => s.status === 'failed') && (
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
              <p className="text-yellow-900 dark:text-yellow-200">
                Some optional steps failed, but your core documentation is complete. 
                You can manually retry failed steps if needed.
              </p>
            </div>
          </div>
        )}
        
        {!state.isRunning && state.steps.every(s => s.status === 'completed') && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-success font-medium">
                All workflow steps completed successfully!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
