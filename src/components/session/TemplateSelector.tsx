import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ClipboardList, TrendingUp, FileOutput } from "lucide-react";

interface TemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TEMPLATES = [
  {
    value: 'soap',
    label: 'SOAP Note',
    description: 'Subjective, Objective, Assessment, Plan',
    icon: FileText
  },
  {
    value: 'hpi',
    label: 'HPI + Assessment + Plan',
    description: 'Detailed history and assessment',
    icon: ClipboardList
  },
  {
    value: 'progress',
    label: 'Progress Note',
    description: 'Follow-up visit documentation',
    icon: TrendingUp
  },
  {
    value: 'discharge',
    label: 'Discharge Summary',
    description: 'Hospital discharge documentation',
    icon: FileOutput
  }
];

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const selectedTemplate = TEMPLATES.find(t => t.value === value) || TEMPLATES[0];
  const Icon = selectedTemplate.icon;
  
  return (
    <div className="space-y-2">
      <Label htmlFor="template-select" className="text-sm font-medium text-foreground">
        Note Template
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="template-select" className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{selectedTemplate.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TEMPLATES.map((template) => {
            const TemplateIcon = template.icon;
            return (
              <SelectItem key={template.value} value={template.value}>
                <div className="flex items-start gap-3 py-1">
                  <TemplateIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{template.label}</span>
                    <span className="text-xs text-muted-foreground">{template.description}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}