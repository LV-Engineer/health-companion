import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

// The signed-in user's own profile (RLS only ever returns their row).
export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileQueryKey(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
