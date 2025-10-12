import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPreferences, useUpdateUserPreferences } from "@/hooks/useUserPreferences";
import { useTemplates } from "@/hooks/useTemplates";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { data: preferences, isLoading } = useUserPreferences();
  const { data: templates = [] } = useTemplates();
  const updatePreferences = useUpdateUserPreferences();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!preferences) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Unable to load preferences. Please try again.</p>
        </div>
      </AppLayout>
    );
  }

  const handleSwitchChange = async (key: string, value: boolean) => {
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      console.log(`✅ Successfully updated ${key} to:`, value);
    } catch (error) {
      toast.error(`Failed to update ${key.replace(/_/g, ' ')}`);
      console.error('Settings update error:', error);
    }
  };

  const handleSelectChange = async (key: string, value: string) => {
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      console.log(`✅ Successfully updated ${key} to:`, value);
    } catch (error) {
      toast.error(`Failed to update ${key.replace(/_/g, ' ')}`);
      console.error('Settings update error:', error);
    }
  };

  const handleNumberChange = async (key: string, value: number) => {
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      console.log(`✅ Successfully updated setting to:`, value);
    } catch (error) {
      toast.error('Failed to update setting');
      console.error('Settings update error:', error);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="display" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="beta">Beta Features</TabsTrigger>
            <TabsTrigger value="coding">Coding</TabsTrigger>
            <TabsTrigger value="data">Data Management</TabsTrigger>
          </TabsList>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize your interface</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Toggle dark theme</p>
                  </div>
                  <Switch 
                    checked={preferences.dark_mode} 
                    onCheckedChange={(checked) => handleSwitchChange('dark_mode', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Sidebar</Label>
                    <p className="text-sm text-muted-foreground">Minimize sidebar by default</p>
                  </div>
                  <Switch 
                    checked={preferences.compact_sidebar} 
                    onCheckedChange={(checked) => handleSwitchChange('compact_sidebar', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Settings</CardTitle>
                <CardDescription>Set default preferences for new sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Input Language</Label>
                    <Select 
                      value={preferences.default_input_language} 
                      onValueChange={(value) => handleSelectChange('default_input_language', value)}
                      disabled={updatePreferences.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Output Language</Label>
                    <Select 
                      value={preferences.default_output_language}
                      onValueChange={(value) => handleSelectChange('default_output_language', value)}
                      disabled={updatePreferences.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default Note Template</Label>
                  <Select 
                    value={preferences.default_template_id || "none"}
                    onValueChange={(value) => handleSelectChange('default_template_id', value === "none" ? "" : value)}
                    disabled={updatePreferences.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No default template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default template</SelectItem>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-create Tasks</Label>
                    <p className="text-sm text-muted-foreground">Automatically extract follow-up tasks from notes</p>
                  </div>
                  <Switch 
                    checked={preferences.auto_create_tasks} 
                    onCheckedChange={(checked) => handleSwitchChange('auto_create_tasks', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control when and how you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch 
                    checked={preferences.email_notifications} 
                    onCheckedChange={(checked) => handleSwitchChange('email_notifications', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Task Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get notified about upcoming tasks</p>
                  </div>
                  <Switch 
                    checked={preferences.task_reminders} 
                    onCheckedChange={(checked) => handleSwitchChange('task_reminders', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Session Summaries</Label>
                    <p className="text-sm text-muted-foreground">Weekly summary of your activity</p>
                  </div>
                  <Switch 
                    checked={preferences.session_summaries} 
                    onCheckedChange={(checked) => handleSwitchChange('session_summaries', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Beta Features Tab */}
          <TabsContent value="beta" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Heidi Labs</CardTitle>
                <CardDescription>Experimental features under development</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Beta Features</Label>
                    <p className="text-sm text-muted-foreground">Access experimental functionality</p>
                  </div>
                  <Switch 
                    checked={preferences.beta_features_enabled} 
                    onCheckedChange={(checked) => handleSwitchChange('beta_features_enabled', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
                {preferences.beta_features_enabled && (
                  <>
                    <Separator />
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Available Beta Features:</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Switch 
                            checked={preferences.advanced_ai_reasoning} 
                            onCheckedChange={(checked) => handleSwitchChange('advanced_ai_reasoning', checked)}
                            disabled={updatePreferences.isPending}
                          />
                          <span>Advanced AI Reasoning</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Switch 
                            checked={preferences.multi_language_transcription} 
                            onCheckedChange={(checked) => handleSwitchChange('multi_language_transcription', checked)}
                            disabled={updatePreferences.isPending}
                          />
                          <span>Multi-language Transcription</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Switch 
                            checked={preferences.voice_commands} 
                            onCheckedChange={(checked) => handleSwitchChange('voice_commands', checked)}
                            disabled={updatePreferences.isPending}
                          />
                          <span>Voice Commands</span>
                        </li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coding Tab */}
          <TabsContent value="coding" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Medical Coding</CardTitle>
                <CardDescription>Configure diagnosis and procedure code suggestions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Coding System</Label>
                  <Select 
                    value={preferences.preferred_coding_system}
                    onValueChange={(value) => handleSelectChange('preferred_coding_system', value)}
                    disabled={updatePreferences.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="icd10">ICD-10</SelectItem>
                      <SelectItem value="snomed">SNOMED CT</SelectItem>
                      <SelectItem value="both">Both (ICD-10 + SNOMED)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-suggest Codes</Label>
                    <p className="text-sm text-muted-foreground">Automatically suggest diagnosis codes</p>
                  </div>
                  <Switch 
                    checked={preferences.auto_suggest_codes} 
                    onCheckedChange={(checked) => handleSwitchChange('auto_suggest_codes', checked)}
                    disabled={updatePreferences.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Retention</CardTitle>
                <CardDescription>Manage your data storage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto-delete completed sessions after</Label>
                  <Select 
                    value={String(preferences.auto_delete_days)}
                    onValueChange={(value) => handleNumberChange('auto_delete_days', parseInt(value))}
                    disabled={updatePreferences.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="0">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="destructive" disabled>Delete All Data</Button>
                <Button variant="destructive" disabled>Close Account</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
