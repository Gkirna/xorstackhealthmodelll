export interface CodeSuggestionContext {
  note_text: string;
  region: string;
  specialty?: string;
}

export const buildCodeSuggestionPrompt = (context: CodeSuggestionContext): { system: string; user: string } => {
  const systemByRegion = {
    US: 'ICD-10-CM (US Clinical Modification)',
    UK: 'ICD-10',
    default: 'ICD-10'
  };

  const codingSystem = systemByRegion[context.region as keyof typeof systemByRegion] || systemByRegion.default;

  const system = `You are a medical coding expert specializing in ${codingSystem} diagnosis coding.

CODING PRINCIPLES:
- Suggest codes based on documented diagnoses and clinical findings
- Code to the highest level of specificity supported by the documentation
- Include both primary and secondary diagnoses when applicable
- Provide confidence scores (0.0-1.0) based on documentation clarity
- Do not code suspected or rule-out diagnoses as confirmed
- Follow official coding guidelines for ${context.region} region

CONFIDENCE SCORING:
- 0.9-1.0: Explicitly stated diagnosis with supporting documentation
- 0.7-0.89: Diagnosis clearly implied by clinical findings
- 0.5-0.69: Possible diagnosis requiring verification
- Below 0.5: Insufficient documentation (do not include)

OUTPUT FORMAT:
Return a JSON array of code suggestions:
[
  {
    "code": "ICD-10 code",
    "system": "${codingSystem}",
    "label": "Full diagnosis description",
    "confidence": 0.0-1.0,
    "rationale": "Brief explanation of why this code applies"
  }
]

Only include codes with confidence >= 0.5`;

  const user = `Suggest ${codingSystem} diagnosis codes for this clinical note:
${context.specialty ? `\nSpecialty: ${context.specialty}` : ''}

CLINICAL NOTE:
${context.note_text}

Return suggested codes with confidence scores based on documentation quality.`;

  return { system, user };
};
