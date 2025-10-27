export interface NoteGenerationContext {
  transcript: string;
  template: 'soap' | 'hpi' | 'progress' | 'discharge';
  detail_level: 'low' | 'medium' | 'high';
  language: string;
  patient_name?: string;
  specialty?: string;
}

const TEMPLATE_FORMATS = {
  soap: {
    name: 'SOAP Note',
    structure: {
      subjective: "Chief complaint, HPI, ROS, relevant history",
      objective: "Vital signs, physical exam findings, test results",
      assessment: "Diagnoses, clinical impressions, differential diagnoses",
      plan: "Treatment plan, medications, follow-up, patient education, discharge instructions"
    }
  },
  hpi: {
    name: 'HPI + Assessment + Plan',
    structure: {
      hpi: "History of Present Illness with timeline, relevant positives and negatives",
      physical_exam: "Physical examination findings organized by system",
      assessment: "Clinical assessment, probable diagnosis, differential diagnoses",
      plan: "Diagnostic workup, treatment plan, medications, referrals, patient education"
    }
  },
  progress: {
    name: 'Progress Note',
    structure: {
      interval_history: "Changes since last visit, response to treatment",
      current_status: "Current symptoms, vital signs, functional status",
      assessment: "Updated clinical assessment",
      plan: "Changes to treatment plan, new orders, follow-up"
    }
  },
  discharge: {
    name: 'Discharge Summary',
    structure: {
      admission_diagnosis: "Reason for admission",
      hospital_course: "Summary of hospital stay, procedures, complications",
      discharge_diagnosis: "Final diagnoses",
      discharge_medications: "Medication list with instructions",
      follow_up: "Follow-up appointments, recommendations, patient instructions"
    }
  }
};

export const buildNoteGenerationPrompt = (context: NoteGenerationContext): { system: string; user: string } => {
  const detailInstructions = {
    low: 'Be concise. Focus only on key findings and essential clinical information.',
    medium: 'Provide standard clinical documentation with appropriate detail for continuity of care.',
    high: 'Be comprehensive. Include detailed observations, relevant negatives, and thorough documentation.'
  };

  const template = TEMPLATE_FORMATS[context.template];
  const sections = Object.entries(template.structure)
    .map(([key, desc]) => `    "${key}": "${desc}"`)
    .join(',\n');

  const system = `You are an expert medical scribe assistant. Generate a structured clinical note using the ${template.name} format.

CRITICAL REQUIREMENTS:
- Follow standard medical documentation practices
- Use appropriate medical terminology and ICD-10 compatible language
- Maintain clinical accuracy and clarity
- Extract information from speaker-labeled transcript (Doctor: / Patient:)
- Organize information logically within the template structure
- ${detailInstructions[context.detail_level]}
- Output language: ${context.language}
- Preserve all clinical details, measurements, and medications mentioned

OUTPUT FORMAT:
Return a valid JSON object with this exact structure:
{
  "template": "${context.template}",
  "sections": {
${sections}
  },
  "plaintext": "Full formatted clinical note as readable text with proper headers"
}

IMPORTANT:
- Each section must be complete and clinically accurate
- Use bullet points or paragraphs as appropriate for readability
- Include specific measurements, dosages, and timeframes
- Maintain professional medical documentation standards`;

  const user = `Generate a ${template.name} from this clinical encounter transcript:

Detail Level: ${context.detail_level}
${context.patient_name ? `Patient: ${context.patient_name}` : ''}
${context.specialty ? `Specialty: ${context.specialty}` : ''}

TRANSCRIPT:
${context.transcript}

INSTRUCTIONS:
- Analyze the speaker-labeled dialogue (Doctor: and Patient: prefixes)
- Extract clinical information systematically
- Format according to the ${template.name} template
- Output valid JSON only, no additional text`;

  return { system, user };
};

