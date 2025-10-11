import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Feedback {
  title: string;
  description: string;
  feedback_type: string;
  priority?: string;
  metadata?: Record<string, any>;
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: Feedback) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          title: feedback.title,
          description: feedback.description,
          feedback_type: feedback.feedback_type,
          priority: feedback.priority || 'medium',
          metadata: feedback.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback submitted successfully');
    },
    onError: (error) => {
      toast.error('Failed to submit feedback: ' + error.message);
    },
  });
}
