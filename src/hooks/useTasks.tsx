import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Task {
  id: string;
  user_id: string;
  session_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  category?: string;
  created_at: string;
  updated_at: string;
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: Partial<Task> & { title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          due_date: taskData.due_date,
          priority: taskData.priority || 'medium',
          status: taskData.status || 'pending',
          category: taskData.category,
          session_id: taskData.session_id,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create task: ' + error.message);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast.error('Failed to update task: ' + error.message);
    },
  });
}
