import { useEffect } from 'react';
import { useUserPreferences, useUpdateUserPreferences } from './useUserPreferences';

export function useTheme() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdateUserPreferences();

  useEffect(() => {
    if (!preferences) return;

    const root = document.documentElement;
    
    if (preferences.dark_mode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences?.dark_mode]);

  const toggleTheme = async () => {
    if (!preferences) return;
    
    const newDarkMode = !preferences.dark_mode;
    
    // Optimistically update UI
    const root = document.documentElement;
    if (newDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Persist to backend
    await updatePreferences.mutateAsync({ dark_mode: newDarkMode });
  };

  return {
    isDark: preferences?.dark_mode ?? false,
    toggleTheme,
    isLoading,
  };
}
