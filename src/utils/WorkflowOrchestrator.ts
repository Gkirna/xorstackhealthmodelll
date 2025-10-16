/**
 * Workflow Orchestrator
 * Manages the complete clinical documentation workflow:
 * Recording → Transcription → Note Generation
 */

import { generateClinicalNote } from '@/ai/heidiBrain';

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

export interface WorkflowState {
  currentStep: number;
  steps: WorkflowStep[];
  isRunning: boolean;
}

export type WorkflowStepName = 
  | 'transcription' 
  | 'note-generation';

export class WorkflowOrchestrator {
  private state: WorkflowState;
  private onStateChange?: (state: WorkflowState) => void;

  constructor(onStateChange?: (state: WorkflowState) => void) {
    this.onStateChange = onStateChange;
    this.state = {
      currentStep: 0,
      isRunning: false,
      steps: [
        { name: 'Transcription Complete', status: 'pending', progress: 0, message: 'Waiting...' },
        { name: 'Generate Clinical Note', status: 'pending', progress: 0, message: 'Waiting...' },
      ]
    };
  }

  private updateStep(index: number, updates: Partial<WorkflowStep>) {
    this.state.steps[index] = { ...this.state.steps[index], ...updates };
    this.notifyStateChange();
  }

  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  /**
   * Run the complete auto-pipeline workflow
   */
  public async runCompletePipeline(
    sessionId: string,
    transcript: string
  ): Promise<{
    success: boolean;
    note?: string;
    errors?: string[];
  }> {
    this.state.isRunning = true;
    this.state.currentStep = 0;
    const errors: string[] = [];

    try {
      // Step 1: Transcription is already complete
      this.updateStep(0, {
        status: 'completed',
        progress: 100,
        message: 'Transcript ready',
      });

      // Step 2: Generate Clinical Note
      this.state.currentStep = 1;
      this.updateStep(1, {
        status: 'in-progress',
        progress: 20,
        message: 'Analyzing transcript...',
      });

      const noteResult = await this.generateNote(sessionId, transcript);
      
      if (!noteResult.success || !noteResult.note) {
        this.updateStep(1, {
          status: 'failed',
          progress: 0,
          message: 'Failed to generate note',
          error: noteResult.error || 'Unknown error',
        });
        errors.push(`Note generation failed: ${noteResult.error}`);
        this.state.isRunning = false;
        this.notifyStateChange();
        return { success: false, errors };
      }

      this.updateStep(1, {
        status: 'completed',
        progress: 100,
        message: 'Clinical note generated successfully',
      });

      this.state.isRunning = false;
      this.notifyStateChange();

      return {
        success: true,
        note: noteResult.note,
      };

    } catch (error) {
      console.error('Workflow orchestration error:', error);
      this.state.isRunning = false;
      
      if (this.state.currentStep < this.state.steps.length) {
        this.updateStep(this.state.currentStep, {
          status: 'failed',
          progress: 0,
          message: 'Workflow failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      this.notifyStateChange();

      return {
        success: false,
        errors: [...errors, error instanceof Error ? error.message : 'Workflow failed'],
      };
    }
  }

  /**
   * Generate clinical note
   */
  private async generateNote(sessionId: string, transcript: string) {
    try {
      this.updateStep(1, { progress: 40, message: 'Generating SOAP note...' });
      
      const result = await generateClinicalNote(sessionId, transcript, 'medium');
      
      this.updateStep(1, { progress: 80, message: 'Note almost ready...' });
      
      return result;
    } catch (error) {
      console.error('Note generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate note',
      };
    }
  }

  /**
   * Run a single step manually
   */
  public async runStep(
    step: WorkflowStepName,
    sessionId: string,
    data: { transcript?: string; note?: string }
  ) {
    const stepIndex = this.getStepIndex(step);
    if (stepIndex === -1) return { success: false, error: 'Invalid step' };

    this.state.currentStep = stepIndex;
    this.state.isRunning = true;

    let result;
    
    switch (step) {
      case 'note-generation':
        if (!data.transcript) return { success: false, error: 'Transcript required' };
        result = await this.generateNote(sessionId, data.transcript);
        break;
        
      default:
        result = { success: false, error: 'Invalid step' };
    }

    this.state.isRunning = false;
    this.notifyStateChange();
    
    return result;
  }

  private getStepIndex(step: WorkflowStepName): number {
    const stepMap: Record<WorkflowStepName, number> = {
      'transcription': 0,
      'note-generation': 1,
    };
    return stepMap[step] ?? -1;
  }

  public getState(): WorkflowState {
    return { ...this.state };
  }

  public reset() {
    this.state = {
      currentStep: 0,
      isRunning: false,
      steps: this.state.steps.map(step => ({
        ...step,
        status: 'pending',
        progress: 0,
        message: 'Waiting...',
        error: undefined,
      })),
    };
    this.notifyStateChange();
  }
}
