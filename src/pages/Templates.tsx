import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FileText, Eye, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTemplates, useCommunityTemplates } from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from 'sonner';

const Templates = () => {
  const { toast } = useToast();
  const { data: personalTemplates = [], isLoading: loadingPersonal } = useTemplates();
  const { data: communityTemplates = [], isLoading: loadingCommunity } = useCommunityTemplates();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("personal");

  // Persist tab and filter state
  useEffect(() => {
    const savedTab = localStorage.getItem('templatesTab');
    const savedCategory = localStorage.getItem('templatesCategory');
    if (savedTab) setActiveTab(savedTab);
    if (savedCategory) setFilterCategory(savedCategory);
  }, []);

  useEffect(() => {
    localStorage.setItem('templatesTab', activeTab);
    localStorage.setItem('templatesCategory', filterCategory);
  }, [activeTab, filterCategory]);

  // Removed hardcoded data - using real database data now via useTemplates hooks

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let structure = {};
      try {
        structure = JSON.parse(formData.get("content") as string || "{}");
      } catch {
        sonnerToast.error('Invalid JSON format for template structure');
        return;
      }

      const { error } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: formData.get("name") as string,
          category: formData.get("category") as string,
          description: formData.get("specialty") as string,
          content: formData.get("content") as string || "",
          structure,
          is_active: true,
          is_community: false,
        });

      if (error) throw error;

      setIsNewTemplateOpen(false);
      sonnerToast.success('Template created successfully');
    } catch (error: any) {
      sonnerToast.error('Failed to create template: ' + error.message);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Templates</h1>
            <p className="text-muted-foreground">Manage your clinical note templates</p>
          </div>
          <Dialog open={isNewTemplateOpen} onOpenChange={setIsNewTemplateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleCreateTemplate}>
                <DialogHeader>
                  <DialogTitle>Create Template</DialogTitle>
                  <DialogDescription>
                    Design a reusable template for clinical documentation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., SOAP Note - Cardiology"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" defaultValue="soap">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soap">SOAP</SelectItem>
                          <SelectItem value="hp">H&P</SelectItem>
                          <SelectItem value="followup">Follow-up</SelectItem>
                          <SelectItem value="procedure">Procedure Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Select name="specialty">
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="family">Family Medicine</SelectItem>
                          <SelectItem value="cardiology">Cardiology</SelectItem>
                          <SelectItem value="psychiatry">Psychiatry</SelectItem>
                          <SelectItem value="surgery">Surgery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Template Structure (JSON)</Label>
                    <Textarea
                      id="content"
                      name="content"
                      placeholder='{"subjective": "", "objective": "", "assessment": "", "plan": ""}'
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewTemplateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Template</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search templates..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="soap">SOAP</SelectItem>
              <SelectItem value="hp">H&P</SelectItem>
              <SelectItem value="followup">Follow-up</SelectItem>
              <SelectItem value="procedure">Procedure</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Templates Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-6">
            {loadingPersonal ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : personalTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground mb-4">No templates yet</p>
                  <Button onClick={() => setIsNewTemplateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {personalTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.name}
                        </CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="space-y-4 mt-6">
            {loadingCommunity ? (
              <div className="text-center py-8 text-muted-foreground">Loading community templates...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {communityTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add to My Templates
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewTemplate?.name}</DialogTitle>
              <DialogDescription>
                {previewTemplate?.description} - {previewTemplate?.category}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(previewTemplate?.structure || {}, null, 2)}
              </pre>
            </div>
            <DialogFooter>
              <Button onClick={() => setPreviewTemplate(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Templates;
