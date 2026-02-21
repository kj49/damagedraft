import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReportPhotoRow } from '../types/models';
import { useThemeContext } from '../lib/theme';

interface PhotoStripProps {
  title: string;
  photos: ReportPhotoRow[];
  onDelete: (photoId: string) => void;
  emptyText?: string;
}

export default function PhotoStrip({ title, photos, onDelete, emptyText = 'No photos yet.' }: PhotoStripProps) {
  const { theme } = useThemeContext();
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const sorted = useMemo(
    () => [...photos].sort((a, b) => b.created_at - a.created_at),
    [photos]
  );

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {sorted.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>{emptyText}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {sorted.map((photo) => {
            const failed = failedIds[photo.id];
            return (
              <View key={photo.id} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}> 
                {failed ? (
                  <View style={[styles.missing, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.missingText, { color: theme.mutedText }]}>missing file</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.image}
                    onError={() => setFailedIds((prev) => ({ ...prev, [photo.id]: true }))}
                  />
                )}
                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: 'rgba(15,23,42,0.78)' }]}
                  onPress={() => onDelete(photo.id)}
                >
                  <Text style={styles.deleteText}>x</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
  },
  row: {
    gap: 10,
    paddingVertical: 2,
  },
  card: {
    width: 92,
    height: 92,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  missingText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
  },
});
