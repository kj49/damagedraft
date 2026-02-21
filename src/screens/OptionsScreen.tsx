import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../components/Button';
import { deleteAllStoredPhotos, deletePhotosOlderThan } from '../db/queries';
import { emailExportFile, exportLogsCsv, exportLogsText } from '../lib/export';
import { useThemeContext } from '../lib/theme';

const PALETTE = ['#1565C0', '#1D4ED8', '#0F766E', '#B45309', '#BE123C', '#7C3AED'];

export default function OptionsScreen() {
  const { theme, settings, saveSettings } = useThemeContext();
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

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme</Text>
        <Text style={[styles.label, { color: theme.mutedText }]}>Primary color</Text>
        <View style={styles.paletteRow}>
          {PALETTE.map((color) => (
            <Pressable
              key={`primary-${color}`}
              onPress={() => void saveSettings({ theme_primary: color })}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: theme.primary === color ? '#0F172A' : '#CBD5E1' },
              ]}
            >
              <Text>{' '}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.mutedText }]}>Accent color</Text>
        <View style={styles.paletteRow}>
          {PALETTE.map((color) => (
            <Pressable
              key={`accent-${color}`}
              onPress={() => void saveSettings({ theme_accent: color })}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: theme.accent === color ? '#0F172A' : '#CBD5E1' },
              ]}
            >
              <Text>{' '}</Text>
            </Pressable>
          ))}
        </View>
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
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
});
