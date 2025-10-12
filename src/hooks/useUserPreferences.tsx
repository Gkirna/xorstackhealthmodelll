import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserPreferences {
  id: string;
  user_id: string;
  dark_mode: boolean;
  compact_sidebar: boolean;
  default_input_language: string;
  default_output_language: string;
  default_template_id?: string;
  auto_create_tasks: boolean;
  email_notifications: boolean;
  task_reminders: boolean;
  session_summaries: boolean;
  beta_features_enabled: boolean;
  advanced_ai_reasoning: boolean;
  multi_language_transcription: boolean;
  voice_commands: boolean;
  preferred_coding_system: string;
  auto_suggest_codes: boolean;
  auto_delete_days: number;
  dashboard_layout: Record<string, any>;
  dashboard_filters: Record<string, any>;
  search_history: string[];
  created_at: string;
  updated_at: string;
}

export function useUserPreferences() {
  return useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // If no preferences exist, create them
      if (error && error.code === 'PGRST116') {
        const { data: newPrefs, error: insertError } = await supabase
          .from('user_preferences')
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newPrefs as UserPreferences;
      }

      if (error) throw error;
      return data as UserPreferences;
    },
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('🔄 Updating preferences:', updates);

      const { data, error } = await supabase
        .from('user_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Update failed:', error);
        throw error;
      }
      
      console.log('✅ Update successful:', data);
      return data as UserPreferences;
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user-preferences'] });

      // Snapshot previous value
      const previousPreferences = queryClient.getQueryData<UserPreferences>(['user-preferences']);

      // Optimistically update cache
      if (previousPreferences) {
        queryClient.setQueryData<UserPreferences>(['user-preferences'], {
          ...previousPreferences,
          ...updates,
        });
      }

      return { previousPreferences };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-preferences'], data);
      toast.success('Settings saved successfully');
    },
    onError: (error, _updates, context) => {
      // Rollback on error
      if (context?.previousPreferences) {
        queryClient.setQueryData(['user-preferences'], context.previousPreferences);
      }
      toast.error('Failed to save settings: ' + error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });
}
