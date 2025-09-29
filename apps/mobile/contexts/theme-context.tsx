import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useColorScheme, View } from 'react-native';
import { HeroUINativeProvider } from 'heroui-native';

import { appTheme, type ThemePreference } from '@/libs/themeConfig';

const storageKey = '@meyoo/mobile/theme-preference';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  setDarkMode: (enabled: boolean) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

type AppThemeProviderProps = React.PropsWithChildren;

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreference] = React.useState<ThemePreference>('system');
  const [hasHydrated, setHasHydrated] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(storageKey)
      .then((storedPreference) => {
        if (!mounted || !storedPreference) {
          return;
        }

        if (
          storedPreference === 'light' ||
          storedPreference === 'dark' ||
          storedPreference === 'system'
        ) {
          setPreference(storedPreference);
        }
      })
      .catch(() => {
        // Ignore hydration failures; fall back to system preference
      })
      .finally(() => {
        if (mounted) {
          setHasHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    AsyncStorage.setItem(storageKey, preference).catch(() => {
      // Ignore persistence failures; the theme can still update in-memory
    });
  }, [preference, hasHydrated]);

  const resolvedScheme = preference === 'system' ? systemScheme : preference;
  const effectiveScheme = resolvedScheme === 'dark' ? 'dark' : 'light';

  const setPreferenceHandler = React.useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
  }, []);

  const setDarkMode = React.useCallback((enabled: boolean) => {
    setPreference(enabled ? 'dark' : 'light');
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedScheme: effectiveScheme,
      isDark: effectiveScheme === 'dark',
      setPreference: setPreferenceHandler,
      setDarkMode,
    }),
    [effectiveScheme, preference, setPreferenceHandler, setDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <HeroUINativeProvider
        config={{
          colorScheme: effectiveScheme,
          theme: appTheme,
          textProps: {
            allowFontScaling: false,
          },
        }}
      >
        <View className="flex-1 bg-background">{children as any}</View>
      </HeroUINativeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return context;
}
