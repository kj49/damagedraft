import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeContext } from '../lib/theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: AppButtonProps) {
  const { theme } = useThemeContext();

  const gradientColors: [string, string] = variant === 'danger'
    ? [theme.danger, '#E25A5A']
    : variant === 'secondary'
      ? [theme.accent, theme.gradientEnd]
      : [theme.gradientStart, theme.gradientEnd];

  const textColor = '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[style, (disabled || loading) && styles.disabled]}
    >
      <LinearGradient colors={gradientColors} style={styles.button}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
