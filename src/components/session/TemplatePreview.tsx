import { FileText, FileCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TemplatePreviewProps {
  structure: any;
}

const formatSectionKey = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const renderTemplateValue = (value: any): JSX.Element => {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1 ml-6">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm text-muted-foreground">
            - {typeof item === 'string' ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey} className="ml-2">
            <span className="text-sm font-medium text-foreground">
              {formatSectionKey(subKey)}:
            </span>
            <div className="ml-4">
              {renderTemplateValue(subValue)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground ml-6">
      - {String(value)}
    </p>
  );
};

const renderExampleValue = (value: any): JSX.Element => {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1 ml-6">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground">
            - {typeof item === 'string' ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey} className="ml-2">
            <span className="text-sm font-medium text-foreground">
              {formatSectionKey(subKey)}:
            </span>
            <div className="ml-4">
              {renderExampleValue(subValue)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm text-foreground ml-6">
      - {String(value)}
    </p>
  );
};

export function TemplatePreview({ structure }: TemplatePreviewProps) {
  const sections = (structure as any)?.sections || structure;

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      {/* Template Content Column */}
      <Card className="border-l-4 border-l-pink-500 bg-gradient-to-br from-pink-50/50 to-background">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-pink-600" />
            <h3 className="text-lg font-bold text-pink-600">Template Content</h3>
          </div>
          
          <div className="space-y-6">
            {Object.entries(sections).map(([key, value]) => {
              if (!value || key === 'template_id' || key === 'plaintext') return null;
              
              const label = formatSectionKey(key);
              
              return (
                <div key={key} className="space-y-2">
                  <h4 className="font-bold text-foreground">{label}:</h4>
                  {renderTemplateValue(value)}
                </div>
              );
            })}
          </div>
          
          <p className="text-xs italic text-muted-foreground pt-4 border-t">
            (Never come up with your own patient details, assessment, plan...)
          </p>
        </div>
      </Card>

      {/* Example Column */}
      <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/50 to-background">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-bold text-purple-600">Example</h3>
          </div>
          
          <div className="space-y-6">
            {Object.entries(sections).map(([key, value]) => {
              if (!value || key === 'template_id' || key === 'plaintext') return null;
              
              const label = formatSectionKey(key);
              
              return (
                <div key={key} className="space-y-2">
                  <h4 className="font-bold text-foreground">{label}:</h4>
                  {renderExampleValue(value)}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
