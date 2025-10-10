import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Mail, Trash2, UserPlus } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

const Team = () => {
  const { toast } = useToast();
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const [teams, setTeams] = useState([
    {
      id: "1",
      name: "Cardiology Department",
      description: "Cardiac care team",
      memberCount: 8,
      role: "owner",
      members: [
        { id: "1", name: "Dr. Sarah Williams", email: "sarah@hospital.com", role: "owner" },
        { id: "2", name: "Dr. Michael Chen", email: "michael@hospital.com", role: "admin" },
        { id: "3", name: "Nurse Jennifer Brown", email: "jennifer@hospital.com", role: "member" },
      ]
    },
    {
      id: "2",
      name: "General Practice",
      description: "Primary care physicians",
      memberCount: 5,
      role: "admin",
      members: [
        { id: "4", name: "Dr. John Doe", email: "john@hospital.com", role: "owner" },
        { id: "5", name: "Dr. Jane Smith", email: "jane@hospital.com", role: "admin" },
      ]
    },
  ]);

  const handleCreateTeam = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTeam = {
      id: String(teams.length + 1),
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      memberCount: 1,
      role: "owner" as const,
      members: []
    };
    setTeams([...teams, newTeam]);
    setIsCreateTeamOpen(false);
    toast({
      title: "Team created",
      description: "Your new team has been created successfully",
    });
  };

  const handleInviteMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsInviteMemberOpen(false);
    toast({
      title: "Invitation sent",
      description: "Team member invitation sent successfully",
    });
  };

  const handleRemoveMember = (memberId: string) => {
    toast({
      title: "Member removed",
      description: "Team member has been removed",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Collaboration</h1>
            <p className="text-muted-foreground">Manage your clinical teams and members</p>
          </div>
          <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTeam}>
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                  <DialogDescription>
                    Set up a new team for collaboration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Team Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., Cardiology Department"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Brief description of the team"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Team</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Teams List */}
        <div className="space-y-4">
          {teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground mb-4">No teams yet</p>
                <Button onClick={() => setIsCreateTeamOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{team.name}</CardTitle>
                        <Badge variant={team.role === "owner" ? "default" : "secondary"}>
                          {team.role}
                        </Badge>
                      </div>
                      <CardDescription>{team.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{team.memberCount} members</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Team Members */}
                    {team.members.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Team Members</h4>
                        <div className="space-y-2">
                          {team.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-sm font-medium text-primary">
                                    {member.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium">{member.name}</div>
                                  <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{member.role}</Badge>
                                {team.role === "owner" && member.role !== "owner" && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove {member.name} from the team. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveMember(member.id)}>
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {(team.role === "owner" || team.role === "admin") && (
                        <Dialog
                          open={isInviteMemberOpen && selectedTeam === team.id}
                          onOpenChange={(open) => {
                            setIsInviteMemberOpen(open);
                            setSelectedTeam(open ? team.id : null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <UserPlus className="mr-2 h-4 w-4" />
                              Invite Member
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <form onSubmit={handleInviteMember}>
                              <DialogHeader>
                                <DialogTitle>Invite Team Member</DialogTitle>
                                <DialogDescription>
                                  Send an invitation to join {team.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="email">Email Address *</Label>
                                  <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="colleague@hospital.com"
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="role">Role</Label>
                                  <Select name="role" defaultValue="member">
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIsInviteMemberOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit">
                                  <Mail className="mr-2 h-4 w-4" />
                                  Send Invitation
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Team;
