import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Template } from './useTemplates';

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Template> }) => {
      const { data, error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Template;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previousTemplates = queryClient.getQueryData<Template[]>(['templates']);

      if (previousTemplates) {
        queryClient.setQueryData<Template[]>(
          ['templates'],
          previousTemplates.map(t => t.id === id ? { ...t, ...updates } : t)
        );
      }

      return { previousTemplates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error, variables, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(['templates'], context.previousTemplates);
      }
      toast.error('Failed to update template: ' + error.message);
    },
  });
}
