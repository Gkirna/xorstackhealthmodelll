import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ClipboardList, TrendingUp, FileOutput, Loader2 } from "lucide-react";
import { useTemplates } from "@/hooks/useTemplates";

interface TemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const ICON_MAP: Record<string, any> = {
  'General': FileText,
  'Mental Health': ClipboardList,
  'Specialty': TrendingUp,
  'hp': FileOutput,
};

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useTemplates();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading templates...
      </div>
    );
  }

  const selectedTemplate = templates?.find(t => t.id === value) || templates?.[0];
  const Icon = selectedTemplate ? (ICON_MAP[selectedTemplate.category] || FileText) : FileText;
  
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
              <span>{selectedTemplate?.name || 'Select template'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {templates?.map((template) => {
            const TemplateIcon = ICON_MAP[template.category] || FileText;
            return (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-start gap-3 py-1">
                  <TemplateIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{template.name}</span>
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