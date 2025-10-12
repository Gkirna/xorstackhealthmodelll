import { useEffect } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: preferences } = useUserPreferences();

  useEffect(() => {
    const root = document.documentElement;
    
    if (preferences?.dark_mode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences?.dark_mode]);

  return <>{children}</>;
}
