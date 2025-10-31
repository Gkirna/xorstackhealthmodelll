import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Session {
  id: string;
  user_id: string;
  patient_name: string;
  patient_id: string;
  patient_dob?: string;
  chief_complaint?: string;
  appointment_type?: string;
  visit_mode: string;
  input_language: string;
  output_language: string;
  scheduled_at?: string;
  status: string;
  generated_note?: string;
  note_json?: any;
  clinical_codes?: any;
  template_id?: string;
  created_at: string;
  updated_at: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Session[];
    },
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data as Session;
    },
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: Partial<Session>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          ...sessionData,
          user_id: user.id,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create session: ' + error.message);
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Session> }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Session;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      await queryClient.cancelQueries({ queryKey: ['session', id] });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData<Session[]>(['sessions']);
      const previousSession = queryClient.getQueryData<Session>(['session', id]);

      // Optimistically update
      if (previousSessions) {
        queryClient.setQueryData<Session[]>(
          ['sessions'],
          previousSessions.map(s => s.id === id ? { ...s, ...updates } : s)
        );
      }
      if (previousSession) {
        queryClient.setQueryData<Session>(['session', id], { ...previousSession, ...updates });
      }

      return { previousSessions, previousSession };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', data.id] });
      toast.success('Session updated successfully');
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(['sessions'], context.previousSessions);
      }
      if (context?.previousSession) {
        queryClient.setQueryData(['session', variables.id], context.previousSession);
      }
      toast.error('Failed to update session: ' + error.message);
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      const previousSessions = queryClient.getQueryData<Session[]>(['sessions']);
      
      if (previousSessions) {
        queryClient.setQueryData<Session[]>(
          ['sessions'],
          previousSessions.filter(s => s.id !== id)
        );
      }
      
      return { previousSessions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error, id, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(['sessions'], context.previousSessions);
      }
      toast.error('Failed to delete session: ' + error.message);
    },
  });
}
