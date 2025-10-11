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
import { 
  useTeams, 
  useTeamMembers,
  useCreateTeam, 
  useInviteTeamMember, 
  useRemoveTeamMember 
} from "@/hooks/useTeams";

const Team = () => {
  const { data: teams = [], isLoading } = useTeams();
  const createTeam = useCreateTeam();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await createTeam.mutateAsync({
      name: formData.get("name") as string,
      description: formData.get("description") as string || undefined,
    });
    
    setIsCreateTeamOpen(false);
  };

  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTeam) return;
    
    const formData = new FormData(e.currentTarget);
    
    await inviteMember.mutateAsync({
      teamId: selectedTeam,
      email: formData.get("email") as string,
      role: formData.get("role") as 'admin' | 'member',
    });
    
    setIsInviteMemberOpen(false);
    setSelectedTeam(null);
  };

  const handleRemoveMember = async (memberId: string, teamId: string) => {
    await removeMember.mutateAsync({ memberId, teamId });
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
                  <Button type="submit" disabled={createTeam.isPending}>
                    {createTeam.isPending ? 'Creating...' : 'Create Team'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Teams List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading teams...</p>
              </CardContent>
            </Card>
          ) : teams.length === 0 ? (
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
            teams.map((team) => <TeamCard 
              key={team.id} 
              team={team}
              onInvite={(teamId) => {
                setSelectedTeam(teamId);
                setIsInviteMemberOpen(true);
              }}
              onRemoveMember={handleRemoveMember}
            />)
          )}
        </div>

        {/* Invite Member Dialog */}
        <Dialog open={isInviteMemberOpen} onOpenChange={(open) => {
          setIsInviteMemberOpen(open);
          if (!open) setSelectedTeam(null);
        }}>
          <DialogContent>
            <form onSubmit={handleInviteMember}>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join the team
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
                <Button type="submit" disabled={inviteMember.isPending}>
                  <Mail className="mr-2 h-4 w-4" />
                  {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

// TeamCard component for better organization
function TeamCard({ 
  team, 
  onInvite, 
  onRemoveMember 
}: { 
  team: any; 
  onInvite: (teamId: string) => void;
  onRemoveMember: (memberId: string, teamId: string) => void;
}) {
  const { data: members = [], isLoading } = useTeamMembers(team.id);
  
  // Determine user's role in this team
  const userMember = members.find(m => m.user_id);
  const userRole = userMember?.role || 'member';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{team.name}</CardTitle>
              <Badge variant={userRole === "owner" ? "default" : "secondary"}>
                {userRole}
              </Badge>
            </div>
            <CardDescription>{team.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{members.length} members</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Team Members */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : members.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Team Members</h4>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{member.email}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.status === 'pending' ? 'Invitation pending' : 'Active'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{member.role}</Badge>
                      {userRole === "owner" && member.role !== "owner" && (
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
                                This will remove {member.email} from the team. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onRemoveMember(member.id, team.id)}>
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
            {(userRole === "owner" || userRole === "admin") && (
              <Button variant="outline" size="sm" onClick={() => onInvite(team.id)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Team;
