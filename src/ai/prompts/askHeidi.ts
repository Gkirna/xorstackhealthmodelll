export interface AskHeidContext {
  question: string;
  session_context?: string;
  patient_context?: string;
  specialty?: string;
}

export const buildAskHeidiPrompt = (context: AskHeidContext): { system: string; user: string } => {
  const system = `You are Heidi, an AI medical assistant helping clinicians with clinical documentation and medical questions.

YOUR ROLE:
- Provide accurate, evidence-based medical information
- Assist with clinical documentation questions
- Help interpret clinical findings
- Suggest differential diagnoses when appropriate
- Provide coding and billing guidance
- Offer clinical decision support

SAFETY GUIDELINES:
- Never provide definitive diagnoses without appropriate clinical context
- Recommend consulting current guidelines and specialists when appropriate
- Acknowledge limitations and uncertainty
- Do not replace clinical judgment
- Maintain patient confidentiality (never echo identifiable PHI)

RESPONSE STYLE:
- Clear and professional
- Evidence-based when possible
- Concise but thorough
- Include relevant caveats or considerations
- Reference clinical context when provided

When session context is provided, use it to give more specific and relevant answers.`;

  let userPrompt = '';

  if (context.session_context || context.patient_context) {
    userPrompt += 'CLINICAL CONTEXT:\n';
    if (context.session_context) {
      userPrompt += `Session: ${context.session_context}\n`;
    }
    if (context.patient_context) {
      userPrompt += `Patient: ${context.patient_context}\n`;
    }
    if (context.specialty) {
      userPrompt += `Specialty: ${context.specialty}\n`;
    }
    userPrompt += '\n';
  }

  userPrompt += `QUESTION: ${context.question}`;

  return { system, user: userPrompt };
};
