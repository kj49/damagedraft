import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../components/Button';
import { deleteAllReportsByStatus, deleteReport, listReports } from '../db/queries';
import { useThemeContext } from '../lib/theme';
import { ReportListItem } from '../types/models';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'IncompleteReports'>;

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export default function IncompleteReportsScreen({ navigation }: Props) {
  const { theme } = useThemeContext();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listReports('incomplete');
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
    Alert.alert('Delete report?', 'This incomplete report will be removed.', [
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

  const confirmDeleteAll = () => {
    Alert.alert('Delete all incomplete reports?', 'This will remove every incomplete report and its photos.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const deleted = await deleteAllReportsByStatus('incomplete');
            await load();
            Alert.alert('Done', `Deleted ${deleted} incomplete report(s).`);
          })();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.topActions}>
        <Button title="Home" variant="secondary" onPress={() => navigation.navigate('Home')} />
        <Button title="Delete All Incomplete" variant="danger" onPress={confirmDeleteAll} />
      </View>
      {loading ? (
        <Text style={{ color: theme.mutedText }}>Loading...</Text>
      ) : reports.length === 0 ? (
        <Text style={{ color: theme.mutedText }}>No incomplete reports.</Text>
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
              <Text style={[styles.itemTitle, { color: theme.text }]}>
                {item.vin_text?.trim() ? `VIN ${item.vin_text}` : 'VIN missing'}
              </Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>{formatDate(item.created_at)}</Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>Location: {item.unit_location || '(none)'}</Text>
              <Text style={[styles.meta, { color: theme.mutedText }]}>Photos: {item.photo_count} | Codes: {item.code_count}</Text>

              <View style={styles.deleteRow}>
                <Button title="Delete" onPress={() => confirmDelete(item.id)} variant="danger" />
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
  list: {
    gap: 10,
    paddingBottom: 16,
  },
  topActions: {
    gap: 8,
    marginBottom: 10,
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
  deleteRow: {
    marginTop: 8,
  },
});
