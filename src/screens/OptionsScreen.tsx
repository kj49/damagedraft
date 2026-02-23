import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../components/Button';
import { deleteAllStoredPhotos, deletePhotosOlderThan } from '../db/queries';
import { emailExportFile, exportLogsCsv, exportLogsText } from '../lib/export';
import { useThemeContext } from '../lib/theme';
import { ThemeMode } from '../types/models';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export default function OptionsScreen() {
  const { theme, settings, effectiveMode, saveSettings } = useThemeContext();
  const [defaultRecipients, setDefaultRecipients] = useState('');
  const [defaultExportEmail, setDefaultExportEmail] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (settings) {
      setDefaultRecipients(settings.default_recipients || '');
      setDefaultExportEmail(settings.default_export_email || '');
    }
  }, [settings]);

  const save = async () => {
    setWorking(true);
    try {
      await saveSettings({
        default_recipients: defaultRecipients,
        default_export_email: defaultExportEmail,
      });
      Alert.alert('Saved', 'Options saved.');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await saveSettings({ theme_mode: mode });
    } catch (error) {
      Alert.alert('Theme update failed', (error as Error).message);
    }
  };

  const cleanupOlder = () => {
    Alert.alert('Delete old photos?', 'Delete photos older than 7 days?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
              const deleted = await deletePhotosOlderThan(cutoff);
              Alert.alert('Cleanup complete', `Deleted ${deleted} photo records.`);
            } catch (error) {
              Alert.alert('Error', (error as Error).message);
            }
          })();
        },
      },
    ]);
  };

  const cleanupAll = () => {
    Alert.alert('Delete all photos?', 'This removes every stored photo record and file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const deleted = await deleteAllStoredPhotos();
              Alert.alert('Cleanup complete', `Deleted ${deleted} photo records.`);
            } catch (error) {
              Alert.alert('Error', (error as Error).message);
            }
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipients</Text>
        <TextInput
          value={defaultRecipients}
          onChangeText={setDefaultRecipients}
          placeholder="email1@example.com;email2@example.com"
          placeholderTextColor={theme.mutedText}
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: theme.mutedText }]}>Default export email (optional)</Text>
        <TextInput
          value={defaultExportEmail}
          onChangeText={setDefaultExportEmail}
          placeholder="exports@example.com"
          placeholderTextColor={theme.mutedText}
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Button title="Save Options" onPress={save} loading={working} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme</Text>
        <Text style={[styles.label, { color: theme.mutedText }]}>Current mode: {effectiveMode}</Text>
        <View style={styles.modeRow}>
          {THEME_MODES.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => void setThemeMode(mode)}
              style={[
                styles.modeButton,
                {
                  borderColor: theme.border,
                  backgroundColor: settings?.theme_mode === mode ? theme.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: settings?.theme_mode === mode ? '#FFFFFF' : theme.text,
                  fontWeight: '700',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Export Logs</Text>
        <Button title="Export CSV" onPress={() => void exportLogsCsv()} />
        <Button title="Export Plain Text" onPress={() => void exportLogsText()} />
        {defaultExportEmail.trim() ? (
          <>
            <Button title="Email Export CSV" variant="secondary" onPress={() => void emailExportFile(defaultExportEmail, 'csv')} />
            <Button title="Email Export Text" variant="secondary" onPress={() => void emailExportFile(defaultExportEmail, 'txt')} />
          </>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Photo Maintenance</Text>
        <Button title="Delete photos older than 7 days" onPress={cleanupOlder} />
        <Button title="Delete ALL stored photos" onPress={cleanupAll} variant="danger" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 84,
    alignItems: 'center',
  },
});
