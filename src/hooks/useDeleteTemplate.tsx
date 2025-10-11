import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Template } from './useTemplates';

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previousTemplates = queryClient.getQueryData<Template[]>(['templates']);
      
      if (previousTemplates) {
        queryClient.setQueryData<Template[]>(
          ['templates'],
          previousTemplates.filter(t => t.id !== id)
        );
      }
      
      return { previousTemplates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error, id, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(['templates'], context.previousTemplates);
      }
      toast.error('Failed to delete template: ' + error.message);
    },
  });
}
