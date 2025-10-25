export interface NoteGenerationContext {
  transcript: string;
  visit_mode: string;
  detail_level: 'low' | 'medium' | 'high';
  language: string;
  patient_name?: string;
  specialty?: string;
}

export const buildNoteGenerationPrompt = (context: NoteGenerationContext): { system: string; user: string } => {
  const detailInstructions = {
    low: 'Be concise. Focus only on key findings and essential clinical information.',
    medium: 'Provide standard clinical documentation with appropriate detail for continuity of care.',
    high: 'Be comprehensive. Include detailed observations, relevant negatives, and thorough documentation.'
  };

  const system = `You are a professional medical scribe assistant. Generate a structured clinical note in SOAP format (Subjective, Objective, Assessment, Plan).

CRITICAL REQUIREMENTS:
- Follow standard medical documentation practices
- Use appropriate medical terminology
- Maintain clinical accuracy and clarity
- Organize information logically
- ${detailInstructions[context.detail_level]}
- Output language: ${context.language}

OUTPUT FORMAT:
Return a valid JSON object with this exact structure:
{
  "soap": {
    "subjective": "Chief complaint, HPI, ROS, relevant history",
    "objective": "Vital signs, physical exam findings, test results",
    "assessment": "Diagnoses, clinical impressions",
    "plan": "Treatment plan, medications, follow-up, patient education"
  },
  "plaintext": "Full formatted clinical note as readable text"
}`;

  const user = `Generate a clinical note from this encounter:

Visit Type: ${context.visit_mode}
Detail Level: ${context.detail_level}
${context.specialty ? `Specialty: ${context.specialty}` : ''}

TRANSCRIPT:
${context.transcript}

Remember to output valid JSON in the exact format specified.`;

  return { system, user };
};

