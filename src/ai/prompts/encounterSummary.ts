export interface EncounterSummaryContext {
  transcript_chunk: string;
  patient_name?: string;
  visit_type?: string;
}

export const buildEncounterSummaryPrompt = (context: EncounterSummaryContext): { system: string; user: string } => {
  const system = `You are a clinical documentation specialist. Provide a concise summary of the patient encounter.

SUMMARY REQUIREMENTS:
- Maximum 200 words
- Focus on clinical relevance
- Include: chief complaint, key findings, diagnoses, and critical action items
- Use clear, professional medical language
- Prioritize information by clinical importance
- Omit redundant or non-essential details

STRUCTURE (if applicable):
1. Chief complaint
2. Relevant history/findings
3. Assessment
4. Key interventions or plan items

Be precise and clinically accurate.`;

  const user = `Summarize this clinical encounter in under 200 words:

${context.visit_type ? `Visit Type: ${context.visit_type}\n` : ''}
TRANSCRIPT:
${context.transcript_chunk}

Provide a concise clinical summary focusing on essential information.`;

  return { system, user };
};
