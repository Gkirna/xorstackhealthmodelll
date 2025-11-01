import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id?: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'active' | 'inactive';
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Team[];
    },
  });
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('role', { ascending: true });

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamData: { name: string; description?: string }) => {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error('Authentication error: ' + authError.message);
      }
      
      if (!user) {
        throw new Error('You must be logged in to create a team');
      }

      console.log('Creating team with user:', user.id);

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamData.name,
          description: teamData.description,
          created_by: user.id,
        })
        .select()
        .single();

      if (teamError) {
        console.error('Team creation error:', teamError);
        throw teamError;
      }

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          email: user.email!,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      return team as Team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create team: ' + error.message);
    },
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      email, 
      role 
    }: { 
      teamId: string; 
      email: string; 
      role: 'admin' | 'member' 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          email,
          role,
          status: 'pending',
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TeamMember;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', variables.teamId] });
      toast.success('Invitation sent successfully');
    },
    onError: (error) => {
      toast.error('Failed to send invitation: ' + error.message);
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, teamId }: { memberId: string; teamId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      return { memberId, teamId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', data.teamId] });
      toast.success('Team member removed');
    },
    onError: (error) => {
      toast.error('Failed to remove member: ' + error.message);
    },
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      memberId, 
      teamId, 
      role 
    }: { 
      memberId: string; 
      teamId: string; 
      role: 'admin' | 'member' 
    }) => {
      const { data, error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId)
        .select()
        .single();

      if (error) throw error;
      return { data, teamId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', result.teamId] });
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });
}
