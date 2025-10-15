import { Upload, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface HeidiContextPanelProps {
  context: string;
  onContextChange: (text: string) => void;
}

export function HeidiContextPanel({
  context,
  onContextChange,
}: HeidiContextPanelProps) {
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    toast.info("File upload feature coming soon");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-4">
      {/* Context Input */}
      <Card className="p-6 rounded-3xl">
        <div className="space-y-3">
          <h3 className="text-[16px] font-semibold">Additional Context</h3>
          <p className="text-[14px] text-muted-foreground">
            Add notes, medical history, or relevant patient information (max 500 characters)
          </p>
          <Textarea
            value={context}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                onContextChange(e.target.value);
              }
            }}
            placeholder="Enter additional clinical context, patient history, medications, allergies, or any relevant information..."
            className="min-h-[200px] text-[16px] leading-relaxed resize-none"
            maxLength={500}
          />
          <div className="text-right">
            <span className="text-[12px] text-muted-foreground">
              {context.length}/500 characters
            </span>
          </div>
        </div>
      </Card>

      {/* File Drop Zone */}
      <Card
        className="p-8 rounded-3xl border-2 border-dashed border-accent-light hover:border-accent transition-colors cursor-pointer"
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-4 bg-accent/10 rounded-full">
            <Upload className="h-8 w-8 text-accent" />
          </div>
          <div>
            <p className="text-[16px] font-medium">Drop files here</p>
            <p className="text-[14px] text-muted-foreground">
              Upload lab results, imaging reports, or other documents
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground">
            PDF, DOCX, JPG, PNG (max 10MB)
          </p>
        </div>
      </Card>
    </div>
  );
}
