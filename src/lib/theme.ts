import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { initDb } from '../db/db';
import { getSettings, updateSettings } from '../db/queries';
import { SettingsRow, ThemeMode } from '../types/models';

export interface AppTheme {
  isDark: boolean;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  danger: string;
  gradientStart: string;
  gradientEnd: string;
}

interface ThemeContextValue {
  theme: AppTheme;
  settings: SettingsRow | null;
  ready: boolean;
  effectiveMode: 'light' | 'dark';
  reloadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<Omit<SettingsRow, 'id'>>) => Promise<SettingsRow>;
}

const LIGHT_THEME: AppTheme = {
  isDark: false,
  primary: '#1A6FE3',
  accent: '#29A8FF',
  background: '#F2F7FF',
  surface: '#FFFFFF',
  text: '#0E1A2A',
  mutedText: '#5C6B80',
  border: '#D7E4F8',
  danger: '#C62828',
  gradientStart: '#1A6FE3',
  gradientEnd: '#35B0FF',
};

const DARK_THEME: AppTheme = {
  isDark: true,
  primary: '#3FA2FF',
  accent: '#69C6FF',
  background: '#060D1A',
  surface: '#0D1830',
  text: '#EEF5FF',
  mutedText: '#9DB1CE',
  border: '#1E335A',
  danger: '#EF5350',
  gradientStart: '#1F5FB9',
  gradientEnd: '#1F9DDE',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveMode(themeMode: ThemeMode | undefined, systemScheme: 'light' | 'dark'): 'light' | 'dark' {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }
  return systemScheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [ready, setReady] = useState(false);

  const reloadSettings = useCallback(async () => {
    await initDb();
    const row = await getSettings();
    setSettings(row);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reloadSettings();
      } finally {
        setReady(true);
      }
    })();
  }, [reloadSettings]);

  const saveSettings = useCallback(async (partial: Partial<Omit<SettingsRow, 'id'>>) => {
    const updated = await updateSettings(partial);
    setSettings(updated);
    return updated;
  }, []);

  const effectiveMode = useMemo(
    () => resolveMode(settings?.theme_mode, systemScheme === 'dark' ? 'dark' : 'light'),
    [settings?.theme_mode, systemScheme]
  );

  const theme = useMemo(
    () => (effectiveMode === 'dark' ? DARK_THEME : LIGHT_THEME),
    [effectiveMode]
  );

  const value = useMemo(
    () => ({
      theme,
      settings,
      ready,
      effectiveMode,
      reloadSettings,
      saveSettings,
    }),
    [theme, settings, ready, effectiveMode, reloadSettings, saveSettings]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
