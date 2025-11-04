import { FileText, FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TemplatePreviewProps {
  structure: any;
}

const exampleData: Record<string, any> = {
  subjective: [
    "34-year-old female presents with a sore throat, runny nose, and dry cough for 3 days.",
    "Throat pain is 4/10, worse with swallowing. No fever reported.",
    "Has been taking lozenges with minimal relief.",
    "Symptoms are stable, not worsening.",
    "No previous severe throat infections.",
    "Finding it slightly difficult to focus at work."
  ],
  past_medical_history: [
    "Seasonal allergic rhinitis.",
    "Non-smoker, socially drinks."
  ],
  objective: [
    "Vitals: Temp 99.1°F, BP 118/76, HR 82, RR 16.",
    "Exam: Pharynx is erythematous, no exudates. Nasal mucosa is mildly swollen. Lungs clear.",
    "Investigations: Rapid strep test is negative."
  ],
  assessment: [
    "Diagnosis: Viral Pharyngitis / Upper Respiratory Infection.",
    "Differential diagnosis: Streptococcal Pharyngitis (less likely)."
  ],
  plan: [
    "Recommendations: Advised rest, hydration, and salt-water gargles.",
    "Treatment planned: OTC analgesics like paracetamol or ibuprofen for throat pain.",
    "Follow-up: Advised to return if symptoms do not improve in 5-7 days or if a fever develops."
  ]
};

const formatSectionKey = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ':';
};

const renderTemplateContent = (data: any): JSX.Element[] => {
  if (typeof data === 'string') {
    return [<div key="text" className="text-muted-foreground ml-4">- {data}</div>];
  }
  
  if (Array.isArray(data)) {
    return data.map((item, index) => (
      <div key={index} className="text-muted-foreground ml-4">- {item}</div>
    ));
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, value]) => (
      <div key={key} className="mb-3">
        <div className="font-semibold mb-1">{formatSectionKey(key)}</div>
        {renderTemplateContent(value)}
      </div>
    ));
  }
  
  return [];
};

const renderExampleContent = (key: string, data: any): JSX.Element[] => {
  const exampleValue = exampleData[key] || data;
  
  if (typeof exampleValue === 'string') {
    return [<div key="text" className="ml-4">- {exampleValue}</div>];
  }
  
  if (Array.isArray(exampleValue)) {
    return exampleValue.map((item, index) => (
      <div key={index} className="ml-4">- {item}</div>
    ));
  }
  
  if (typeof exampleValue === 'object' && exampleValue !== null) {
    return Object.entries(exampleValue).map(([subKey, value]) => (
      <div key={subKey} className="mb-3">
        <div className="font-semibold mb-1">{formatSectionKey(subKey)}</div>
        {renderExampleContent(subKey, value)}
      </div>
    ));
  }
  
  return [];
};

export function TemplatePreview({ structure }: TemplatePreviewProps) {
  if (!structure || typeof structure !== 'object') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No template structure available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Template Content Column */}
      <Card className="border-l-4 border-l-pink-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-pink-500" />
            <h3 className="text-lg font-semibold text-pink-500">Template Content</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(structure).map(([key, value]) => (
              <div key={key}>
                <div className="font-semibold mb-2">{formatSectionKey(key)}</div>
                {renderTemplateContent(value)}
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
            (Never come up with your own patient details, assessment, plan...)
          </div>
        </CardContent>
      </Card>

      {/* Example Column */}
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-purple-500">Example</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(structure).map(([key, value]) => (
              <div key={key}>
                <div className="font-semibold mb-2">{formatSectionKey(key)}</div>
                {renderExampleContent(key, value)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}