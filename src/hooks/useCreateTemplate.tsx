import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Template } from './useTemplates';

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: Partial<Template>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .insert({
          ...templateData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });
}
