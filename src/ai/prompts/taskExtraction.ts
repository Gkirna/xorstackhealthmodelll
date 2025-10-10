export interface TaskExtractionContext {
  note_text: string;
  specialty?: string;
}

export const buildTaskExtractionPrompt = (context: TaskExtractionContext): { system: string; user: string } => {
  const system = `You are a clinical workflow assistant. Extract actionable follow-up tasks from clinical notes.

TASK TYPES TO IDENTIFY:
- Laboratory orders
- Imaging studies
- Referrals to specialists
- Follow-up appointments
- Patient education items
- Medication management (refills, titration)
- Procedure scheduling
- Care coordination activities

PRIORITY LEVELS:
- high: Urgent/time-sensitive (e.g., abnormal labs requiring immediate attention)
- medium: Important but not urgent (e.g., routine follow-up in 2 weeks)
- low: Optional or long-term items (e.g., lifestyle counseling)

CATEGORIES:
- lab_order
- imaging_order
- referral
- follow_up
- patient_education
- medication
- procedure
- coordination

Extract only clear, actionable tasks. Do not infer tasks that are not explicitly mentioned.`;

  const user = `Extract follow-up tasks from this clinical note:
${context.specialty ? `\nSpecialty Context: ${context.specialty}` : ''}

CLINICAL NOTE:
${context.note_text}

Return tasks that are clearly documented in the note.`;

  return { system, user };
};

export const taskExtractionToolDefinition = {
  type: 'function',
  function: {
    name: 'extract_tasks',
    description: 'Extract actionable tasks from the clinical note',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { 
                type: 'string',
                description: 'Clear, actionable task title'
              },
              description: { 
                type: 'string',
                description: 'Additional details or context'
              },
              priority: { 
                type: 'string', 
                enum: ['low', 'medium', 'high'],
                description: 'Clinical urgency level'
              },
              category: { 
                type: 'string',
                description: 'Task category (lab_order, imaging_order, referral, follow_up, patient_education, medication, procedure, coordination)'
              },
              due_date_suggestion: {
                type: 'string',
                description: 'Suggested timeframe if mentioned (e.g., "in 2 weeks", "tomorrow")'
              }
            },
            required: ['title', 'priority', 'category'],
            additionalProperties: false
          }
        }
      },
      required: ['tasks'],
      additionalProperties: false
    }
  }
};
