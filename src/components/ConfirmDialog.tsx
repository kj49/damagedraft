import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeContext } from '../lib/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible,
  title = 'Confirm',
  message,
  confirmLabel = 'Proceed',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { theme } = useThemeContext();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.text }]}>{message}</Text>

          <View style={styles.row}>
            <Pressable style={[styles.action, styles.cancel]} onPress={onCancel}>
              <Text style={[styles.actionText, { color: theme.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={[styles.action, { backgroundColor: theme.primary }]} onPress={onConfirm}>
              <Text style={[styles.actionText, { color: '#fff' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 10,
  },
  action: {
    minWidth: 92,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#E2E8F0',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
