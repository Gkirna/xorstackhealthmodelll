/**
 * Workflow Orchestrator
 * Manages the complete clinical documentation workflow:
 * Recording → Transcription → Note Generation → Task Extraction → ICD-10 Coding
 */

import { generateClinicalNote } from '@/ai/heidiBrain';
import { extractTasks, suggestCodes } from '@/lib/api';

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
  | 'note-generation' 
  | 'task-extraction' 
  | 'code-suggestion';

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
        { name: 'Extract Tasks', status: 'pending', progress: 0, message: 'Waiting...' },
        { name: 'Suggest ICD-10 Codes', status: 'pending', progress: 0, message: 'Waiting...' },
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
    tasks?: any[];
    codes?: any[];
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
        message: 'Clinical note generated',
      });

      // Step 3: Extract Tasks (optional - continues even if fails)
      this.state.currentStep = 2;
      this.updateStep(2, {
        status: 'in-progress',
        progress: 20,
        message: 'Identifying actionable items...',
      });

      let extractedTasks: any[] = [];
      try {
        const tasksResult = await this.extractTasksFromNote(sessionId, noteResult.note);
        
        if (tasksResult.success && tasksResult.tasks) {
          extractedTasks = tasksResult.tasks;
          this.updateStep(2, {
            status: 'completed',
            progress: 100,
            message: `${tasksResult.tasks.length} tasks identified`,
          });
        } else {
          throw new Error(tasksResult.error || 'Failed to extract tasks');
        }
      } catch (error) {
        this.updateStep(2, {
          status: 'failed',
          progress: 0,
          message: 'Task extraction failed (optional)',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errors.push(`Task extraction failed: ${error}`);
        // Continue with workflow
      }

      // Step 4: Suggest ICD-10 Codes (optional - continues even if fails)
      this.state.currentStep = 3;
      this.updateStep(3, {
        status: 'in-progress',
        progress: 20,
        message: 'Analyzing for diagnostic codes...',
      });

      let suggestedCodes: any[] = [];
      try {
        const codesResult = await this.suggestDiagnosticCodes(sessionId, noteResult.note);
        
        if (codesResult.success && codesResult.codes) {
          suggestedCodes = codesResult.codes;
          this.updateStep(3, {
            status: 'completed',
            progress: 100,
            message: `${codesResult.codes.length} codes suggested`,
          });
        } else {
          throw new Error(codesResult.error || 'Failed to suggest codes');
        }
      } catch (error) {
        this.updateStep(3, {
          status: 'failed',
          progress: 0,
          message: 'Code suggestion failed (optional)',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errors.push(`Code suggestion failed: ${error}`);
        // Continue - this is optional
      }

      this.state.isRunning = false;
      this.notifyStateChange();

      return {
        success: true,
        note: noteResult.note,
        tasks: extractedTasks,
        codes: suggestedCodes,
        errors: errors.length > 0 ? errors : undefined,
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
   * Extract tasks from clinical note
   */
  private async extractTasksFromNote(sessionId: string, noteText: string) {
    try {
      this.updateStep(2, { progress: 50, message: 'Analyzing for tasks...' });
      
      const result = await extractTasks(sessionId, noteText);
      
      this.updateStep(2, { progress: 80, message: 'Tasks identified...' });
      
      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Failed to extract tasks',
        };
      }
      
      return {
        success: result.success,
        tasks: result.data,
      };
    } catch (error) {
      console.error('Task extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract tasks',
      };
    }
  }

  /**
   * Suggest ICD-10 diagnostic codes
   */
  private async suggestDiagnosticCodes(sessionId: string, noteText: string) {
    try {
      this.updateStep(3, { progress: 50, message: 'Analyzing diagnoses...' });
      
      const result = await suggestCodes(sessionId, noteText, 'US');
      
      this.updateStep(3, { progress: 80, message: 'Codes identified...' });
      
      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Failed to suggest codes',
        };
      }
      
      return {
        success: result.success,
        codes: result.data,
      };
    } catch (error) {
      console.error('Code suggestion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suggest codes',
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
        
      case 'task-extraction':
        if (!data.note) return { success: false, error: 'Note required' };
        result = await this.extractTasksFromNote(sessionId, data.note);
        break;
        
      case 'code-suggestion':
        if (!data.note) return { success: false, error: 'Note required' };
        result = await this.suggestDiagnosticCodes(sessionId, data.note);
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
      'task-extraction': 2,
      'code-suggestion': 3,
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
