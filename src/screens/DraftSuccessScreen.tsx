import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../components/Button';
import { useThemeContext } from '../lib/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DraftSuccess'>;

export default function DraftSuccessScreen({ navigation, route }: Props) {
  const { theme } = useThemeContext();
  const { reportId } = route.params;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Text style={[styles.title, { color: theme.primary }]}>Draft Opened</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>Email compose opened successfully. Send it from your email app when ready.</Text>

      <View style={styles.buttons}>
        <Button title="New Report" onPress={() => navigation.replace('ReportEditor')} />
        <Button title="Completed Reports" variant="secondary" onPress={() => navigation.replace('CompletedReports')} />
        <Button title="Home" variant="secondary" onPress={() => navigation.replace('Home')} />
        <Button title="Back To This Report" variant="secondary" onPress={() => navigation.replace('ReportEditor', { reportId })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  buttons: {
    gap: 10,
  },
});
