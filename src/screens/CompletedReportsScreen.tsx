import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../components/Button';
import { deleteReport, listReports, quickDuplicateReport } from '../db/queries';
import { useThemeContext } from '../lib/theme';
import { ReportListItem } from '../types/models';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletedReports'>;
type DateFilter = 'all' | 'today' | 'last7' | 'custom';

const FILTERS: Array<{ key: DateFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'custom', label: 'Custom Range' },
];

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

function startOfDay(value: Date): Date {
  const out = new Date(value);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(value: Date): Date {
  const out = new Date(value);
  out.setHours(23, 59, 59, 999);
  return out;
}

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const yyyy = Number(match[1]);
  const mm = Number(match[2]);
  const dd = Number(match[3]);
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }
  return date;
}

export default function CompletedReportsScreen({ navigation }: Props) {
  const { theme } = useThemeContext();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatingReportId, setDuplicatingReportId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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

  const handleQuickDuplicate = (id: string) => {
    void (async () => {
      setDuplicatingReportId(id);
      try {
        const duplicated = await quickDuplicateReport(id);
        navigation.navigate('ReportEditor', { reportId: duplicated.id });
      } catch (error) {
        Alert.alert('Duplicate failed', (error as Error).message);
      } finally {
        setDuplicatingReportId(null);
      }
    })();
  };

  const filteredReports = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    let rows = reports;

    if (query) {
      rows = rows.filter((item) => {
        const haystack = [
          item.vin_text,
          item.unit_location,
          item.make_text,
          item.model_text,
          item.manufacturer_group,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    const now = new Date();
    if (dateFilter === 'today') {
      const start = startOfDay(now).getTime();
      const end = endOfDay(now).getTime();
      rows = rows.filter((item) => item.created_at >= start && item.created_at <= end);
    } else if (dateFilter === 'last7') {
      const start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)).getTime();
      const end = endOfDay(now).getTime();
      rows = rows.filter((item) => item.created_at >= start && item.created_at <= end);
    } else if (dateFilter === 'custom') {
      const parsedStart = parseDateOnly(customStart);
      const parsedEnd = parseDateOnly(customEnd);
      if (parsedStart && parsedEnd) {
        const start = startOfDay(parsedStart).getTime();
        const end = endOfDay(parsedEnd).getTime();
        if (start <= end) {
          rows = rows.filter((item) => item.created_at >= start && item.created_at <= end);
        }
      }
    }

    return rows;
  }, [reports, searchText, dateFilter, customStart, customEnd]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.topActions}>
        <Button title="Home" variant="secondary" onPress={() => navigation.navigate('Home')} />
        <Button title="New Report" onPress={() => navigation.navigate('ReportEditor')} />
      </View>

      <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.filterTitle, { color: theme.text }]}>Search</Text>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          style={[styles.searchInput, { borderColor: theme.border, color: theme.text }]}
          autoCapitalize="characters"
        />
        <Text style={[styles.filterTitle, { color: theme.text }]}>Filter By Date</Text>
        <View style={styles.filterRow}>
          {FILTERS.map((filterItem) => {
            const selected = dateFilter === filterItem.key;
            return (
              <Pressable
                key={filterItem.key}
                onPress={() => setDateFilter(filterItem.key)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontWeight: '700', fontSize: 12 }}>
                  {filterItem.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {dateFilter === 'custom' ? (
          <View style={styles.customRow}>
            <View style={styles.customInputWrap}>
              <Text style={[styles.customLabel, { color: theme.mutedText }]}>Start (YYYY-MM-DD)</Text>
              <TextInput
                value={customStart}
                onChangeText={setCustomStart}
                style={[styles.searchInput, { borderColor: theme.border, color: theme.text }]}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.customInputWrap}>
              <Text style={[styles.customLabel, { color: theme.mutedText }]}>End (YYYY-MM-DD)</Text>
              <TextInput
                value={customEnd}
                onChangeText={setCustomEnd}
                style={[styles.searchInput, { borderColor: theme.border, color: theme.text }]}
                autoCapitalize="none"
              />
            </View>
          </View>
        ) : null}

        <Text style={[styles.countText, { color: theme.mutedText }]}>
          Showing {filteredReports.length} of {reports.length} completed reports
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: theme.mutedText }}>Loading...</Text>
      ) : filteredReports.length === 0 ? (
        <Text style={{ color: theme.mutedText }}>
          {reports.length === 0 ? 'No completed reports yet.' : 'No reports match your current search/filter.'}
        </Text>
      ) : (
        <FlatList
          data={filteredReports}
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
                <Button
                  title="Quick Duplicate"
                  variant="secondary"
                  onPress={() => handleQuickDuplicate(item.id)}
                  loading={duplicatingReportId === item.id}
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
  filterCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customInputWrap: {
    flex: 1,
    gap: 4,
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
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
