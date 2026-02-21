import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../components/Button';
import { deleteReport, listReports } from '../db/queries';
import { useThemeContext } from '../lib/theme';
import { ReportListItem } from '../types/models';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletedReports'>;

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export default function CompletedReportsScreen({ navigation }: Props) {
  const { theme } = useThemeContext();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listReports('completed');
      setReports(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const confirmDelete = (id: string) => {
    Alert.alert('Delete report?', 'This completed report will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteReport(id);
            await load();
          })();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.topActions}>
        <Button title="Home" variant="secondary" onPress={() => navigation.navigate('Home')} />
        <Button title="New Report" onPress={() => navigation.navigate('ReportEditor')} />
      </View>

      {loading ? (
        <Text style={{ color: theme.mutedText }}>Loading...</Text>
      ) : reports.length === 0 ? (
        <Text style={{ color: theme.mutedText }}>No completed reports yet.</Text>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('ReportEditor', { reportId: item.id })}
              style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.itemTitle, { color: theme.text }]}>VIN {item.vin_text || '(missing)'}</Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>{formatDate(item.created_at)}</Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>Location: {item.unit_location || '(none)'}</Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>Photos: {item.photo_count} | Codes: {item.code_count}</Text>

              <View style={styles.buttons}>
                <Button
                  title="Open"
                  onPress={() => navigation.navigate('ReportEditor', { reportId: item.id })}
                />
                <Button title="Delete" variant="danger" onPress={() => confirmDelete(item.id)} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
  },
  topActions: {
    gap: 8,
    marginBottom: 10,
  },
  list: {
    gap: 10,
    paddingBottom: 16,
  },
  item: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
  },
  buttons: {
    marginTop: 8,
    gap: 8,
  },
});
