import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { initDb } from '../db/db';
import { getSettings, updateSettings } from '../db/queries';
import { SettingsRow } from '../types/models';

export interface AppTheme {
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
  reloadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<Omit<SettingsRow, 'id'>>) => Promise<SettingsRow>;
}

const FALLBACK_THEME: AppTheme = {
  primary: '#1565C0',
  accent: '#42A5F5',
  background: '#F4F8FF',
  surface: '#FFFFFF',
  text: '#0F172A',
  mutedText: '#64748B',
  border: '#DCE7F8',
  danger: '#C62828',
  gradientStart: '#1E6FD6',
  gradientEnd: '#4EA9FF',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3
    ? `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
    : clean;
  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blend(hexA: string, hexB: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return rgbToHex(mix(ar, br), mix(ag, bg), mix(ab, bb));
}

function buildTheme(primary: string, accent: string): AppTheme {
  return {
    primary,
    accent,
    background: blend(primary, '#FFFFFF', 0.93),
    surface: '#FFFFFF',
    text: '#0F172A',
    mutedText: '#64748B',
    border: blend(primary, '#FFFFFF', 0.83),
    danger: '#C62828',
    gradientStart: blend(primary, '#0B5ED7', 0.3),
    gradientEnd: blend(accent, '#6EC1FF', 0.22),
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
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

  const theme = useMemo(() => {
    if (!settings) {
      return FALLBACK_THEME;
    }
    return buildTheme(settings.theme_primary || FALLBACK_THEME.primary, settings.theme_accent || FALLBACK_THEME.accent);
  }, [settings]);

  const value = useMemo(
    () => ({
      theme,
      settings,
      ready,
      reloadSettings,
      saveSettings,
    }),
    [theme, settings, ready, reloadSettings, saveSettings]
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
