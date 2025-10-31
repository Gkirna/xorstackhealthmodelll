import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Plus } from "lucide-react";
import { useTemplates } from "@/hooks/useTemplates";

interface TemplateSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: string) => void;
  onCancel: () => void;
}

export function TemplateSelectionDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  onCancel,
}: TemplateSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: templates, isLoading } = useTemplates();
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const filteredTemplates = templates?.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !selectedFilter || template.category === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const categories = Array.from(new Set(templates?.map(t => t.category) || []));

  const handleTemplateSelect = (templateId: string) => {
    onSelectTemplate(templateId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl">Generate a note with AI</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search or generate anything"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedFilter(null)}
            >
              Sort
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedFilter(null)}
            >
              Type
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              Creator
            </Button>
            <div className="flex-1" />
            <span className="text-muted-foreground">Hide Pro</span>
          </div>

          {/* Note Templates Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Note templates</h3>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Loading templates...
                  </div>
                ) : filteredTemplates && filteredTemplates.length > 0 ? (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left group"
                    >
                      <FileText className="h-5 w-5 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                            {template.name}
                          </h4>
                          {template.is_community && (
                            <Badge variant="secondary" className="text-xs">
                              Pro
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No templates found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Create New Template */}
          <button className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors text-left">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Create new template</span>
          </button>

          {/* Bottom Usage Info */}
          <div className="pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              You have <span className="font-medium text-foreground">9</span> Note or Document actions remaining this month
              <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-xs">
                Get unlimited
              </Button>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
