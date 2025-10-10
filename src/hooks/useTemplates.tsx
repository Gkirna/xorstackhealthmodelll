import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  structure: any;
  is_community: boolean;
  is_active: boolean;
  created_at: string;
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Template[];
    },
  });
}

export function useCommunityTemplates() {
  return useQuery({
    queryKey: ['templates', 'community'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_community', true)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Template[];
    },
  });
}
