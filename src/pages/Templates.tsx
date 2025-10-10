import { useState } from "react";
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

const Templates = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const personalTemplates = [
    {
      id: "1",
      name: "SOAP Note - General",
      category: "SOAP",
      specialty: "Family Medicine",
      usageCount: 45,
      isDefault: true,
      content: {
        subjective: "Chief complaint, HPI, ROS",
        objective: "Vitals, Physical Exam",
        assessment: "Diagnosis, DDx",
        plan: "Treatment plan, follow-up"
      }
    },
    {
      id: "2",
      name: "H&P - Cardiology",
      category: "H&P",
      specialty: "Cardiology",
      usageCount: 23,
      isDefault: false,
      content: {
        history: "Cardiac history, risk factors",
        examination: "Cardiovascular exam",
        plan: "Diagnostic workup, treatment"
      }
    },
  ];

  const communityTemplates = [
    {
      id: "3",
      name: "Diabetes Follow-up",
      category: "Follow-up",
      specialty: "Endocrinology",
      usageCount: 156,
      author: "Dr. Smith",
      rating: 4.8,
    },
    {
      id: "4",
      name: "Mental Health Intake",
      category: "Initial",
      specialty: "Psychiatry",
      usageCount: 89,
      author: "Dr. Johnson",
      rating: 4.6,
    },
  ];

  const handleCreateTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsNewTemplateOpen(false);
    toast({
      title: "Template created",
      description: "Your new template has been saved successfully",
    });
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
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {personalTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.name}
                          {template.isDefault && (
                            <Star className="h-4 w-4 fill-primary text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription>{template.specialty}</CardDescription>
                      </div>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Used {template.usageCount} times
                      </div>
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
          </TabsContent>

          <TabsContent value="community" className="space-y-4 mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {communityTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>by {template.author}</CardDescription>
                      </div>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{template.specialty}</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span>{template.rating}</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {template.usageCount} uses
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add to My Templates
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewTemplate?.name}</DialogTitle>
              <DialogDescription>
                {previewTemplate?.specialty} - {previewTemplate?.category}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(previewTemplate?.content, null, 2)}
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
