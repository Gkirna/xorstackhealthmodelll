import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, ClipboardList, TrendingUp, FileOutput, Loader2, Search } from "lucide-react";
import { useTemplates } from "@/hooks/useTemplates";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: string) => void;
  isGenerating?: boolean;
}

const ICON_MAP: Record<string, any> = {
  'General': FileText,
  'Mental Health': ClipboardList,
  'Specialty': TrendingUp,
  'hp': FileOutput,
};

export function TemplateSelectionDialog({ 
  open, 
  onOpenChange, 
  onSelectTemplate,
  isGenerating = false 
}: TemplateSelectionDialogProps) {
  const { data: templates, isLoading } = useTemplates();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = templates?.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTemplateSelect = (templateId: string) => {
    onSelectTemplate(templateId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Select Note Template</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search or generate anything"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Template List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground mb-3">Note templates</div>
                
                {filteredTemplates?.map((template) => {
                  const Icon = ICON_MAP[template.category] || FileText;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      disabled={isGenerating}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredTemplates?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No templates found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Create New Template Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              // Could navigate to template creation or open another dialog
              onOpenChange(false);
            }}
            disabled={isGenerating}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create new template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
