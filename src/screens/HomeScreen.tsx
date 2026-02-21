import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../components/Button';
import { listPendingSendConfirmations, markReportSentConfirmed } from '../db/queries';
import { useThemeContext } from '../lib/theme';
import { PendingSendConfirmationItem } from '../types/models';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function prettyDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

export default function HomeScreen({ navigation }: Props) {
  const { theme } = useThemeContext();
  const [pendingItems, setPendingItems] = useState<PendingSendConfirmationItem[]>([]);

  const loadPending = useCallback(async () => {
    const rows = await listPendingSendConfirmations();
    setPendingItems(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPending();
    }, [loadPending])
  );

  const confirmSent = (reportId: string) => {
    Alert.alert('Mark as sent?', 'Confirm this draft was sent from email app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Sent',
        onPress: () => {
          void (async () => {
            await markReportSentConfirmed(reportId);
            await loadPending();
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.primary }]}>DamageDraft</Text>

      <View style={styles.buttons}>
        <Button title="New Report" onPress={() => navigation.navigate('ReportEditor')} />
        <Button title="Incomplete Reports" onPress={() => navigation.navigate('IncompleteReports')} />
        <Button title="Completed Reports" onPress={() => navigation.navigate('CompletedReports')} />
        <Button title="Options" onPress={() => navigation.navigate('Options')} variant="secondary" />
      </View>

      <View style={[styles.pendingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <Text style={[styles.pendingTitle, { color: theme.text }]}>Pending_Send_Confirmation</Text>

        {pendingItems.length === 0 ? (
          <Text style={{ color: theme.mutedText }}>No pending send confirmations.</Text>
        ) : (
          <View style={styles.pendingList}>
            {pendingItems.map((item) => (
              <View key={item.id} style={[styles.pendingItem, { borderColor: theme.border }]}> 
                <Text style={[styles.pendingMeta, { color: theme.text }]}>VIN: {item.vin_text || '(missing)'}</Text>
                <Text style={[styles.pendingMeta, { color: theme.text }]}>Location: {item.unit_location || '(none)'}</Text>
                <Text style={[styles.pendingMeta, { color: theme.text }]}>Codes: {item.codes_pipe || '(none)'}</Text>
                <Text style={[styles.pendingMeta, { color: theme.mutedText }]}>Make Group: {item.manufacturer_group}</Text>
                <Text style={[styles.pendingMeta, { color: theme.mutedText }]}>Date: {prettyDate(item.updated_at)}</Text>

                <View style={styles.pendingButtons}>
                  <Button title="Yes, Sent" onPress={() => confirmSent(item.id)} />
                  <Button
                    title="Review"
                    variant="secondary"
                    onPress={() => navigation.navigate('ReportEditor', { reportId: item.id })}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  title: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 6,
  },
  buttons: {
    gap: 10,
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  pendingTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  pendingList: {
    gap: 8,
  },
  pendingItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  pendingMeta: {
    fontSize: 13,
  },
  pendingButtons: {
    marginTop: 8,
    gap: 8,
  },
});
