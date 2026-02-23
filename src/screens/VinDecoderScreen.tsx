import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import Button from '../components/Button';
import { decodeVinInfo } from '../lib/vin';
import { extractVinFromImage, hasVinAmbiguousChars, normalizeVinLight } from '../lib/ocr';
import { saveCapturedPhoto } from '../lib/images';
import { useThemeContext } from '../lib/theme';

export default function VinDecoderScreen() {
  const { theme } = useThemeContext();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [vinInput, setVinInput] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const decoded = useMemo(() => decodeVinInfo(vinInput), [vinInput]);
  const hasAmbiguous = useMemo(() => hasVinAmbiguousChars(vinInput), [vinInput]);

  const openCamera = async () => {
    if (permission?.granted) {
      setCameraReady(false);
      setCameraVisible(true);
      return;
    }
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert('Camera permission required', 'Enable camera access to capture VIN labels.');
      return;
    }
    setCameraReady(false);
    setCameraVisible(true);
  };

  const captureVin = async () => {
    if (!cameraRef.current || cameraBusy || !cameraReady) {
      return;
    }

    setCameraBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        return;
      }

      const savedUri = await saveCapturedPhoto(photo.uri, true);
      setPhotoUri(savedUri);
      setCameraVisible(false);

      const extracted = await extractVinFromImage(savedUri);
      if (extracted) {
        setVinInput(normalizeVinLight(extracted));
      } else {
        Alert.alert('No VIN found', 'OCR did not find a VIN. You can enter it manually.');
      }
    } catch (error) {
      Alert.alert('Capture failed', (error as Error).message);
    } finally {
      setCameraBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>VIN Input</Text>
          <TextInput
            value={vinInput}
            onChangeText={setVinInput}
            autoCapitalize="characters"
            placeholder="Enter VIN (17) or use OCR"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          />
          <Button title="Capture VIN Photo (OCR)" onPress={() => void openCamera()} />
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
          {hasAmbiguous ? (
            <Text style={styles.warnText}>
              OCR note: VINs cannot contain I, O, or Q. Please verify those characters.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Decoded</Text>
          <Text style={[styles.row, { color: theme.text }]}>VIN: {decoded.vinNormalized || '(none)'}</Text>
          <Text style={[styles.row, { color: theme.text }]}>Length: {decoded.vinLength}</Text>
          <Text style={[styles.row, { color: theme.text }]}>Full VIN: {decoded.isFullVin ? 'Yes' : 'No'}</Text>
          <Text style={[styles.row, { color: theme.text }]}>Make: {decoded.likelyMake}</Text>
          <Text style={[styles.row, { color: theme.text }]}>Group: {decoded.manufacturerGroup}</Text>
          <Text style={[styles.row, { color: theme.text }]}>WMI (1-3): {decoded.wmi || '-'}</Text>
          <Text style={[styles.row, { color: theme.text }]}>VDS (4-9): {decoded.vds || '-'}</Text>
          <Text style={[styles.row, { color: theme.text }]}>VIS (10-17): {decoded.vis || '-'}</Text>
          <Text style={[styles.row, { color: theme.text }]}>11th char: {decoded.assemblyChar || '-'}</Text>
          {decoded.fordHold ? (
            <View style={[styles.fordBox, { borderColor: theme.border }]}>
              <Text style={[styles.fordRow, { color: theme.text }]}>Ford Hold Code: {decoded.fordHold.holdCode}</Text>
              <Text style={[styles.fordRow, { color: theme.text }]}>Plant: {decoded.fordHold.plantName}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={cameraVisible} animationType="slide" onRequestClose={() => setCameraVisible(false)}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={(ref) => { cameraRef.current = ref; }}
            style={styles.camera}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraTitle}>Capture VIN Photo</Text>
            <View style={styles.cameraButtons}>
              <Pressable style={[styles.cameraBtn, styles.cameraBtnSecondary]} onPress={() => setCameraVisible(false)}>
                <Text style={styles.cameraBtnText}>Done</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.cameraBtn,
                  styles.cameraBtnPrimary,
                  (!cameraReady || cameraBusy) && styles.cameraBtnDisabled,
                ]}
                onPress={() => void captureVin()}
                disabled={!cameraReady || cameraBusy}
              >
                <Text style={styles.cameraBtnText}>
                  {!cameraReady ? 'Starting Camera...' : cameraBusy ? 'Saving...' : 'Shutter'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  preview: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  warnText: {
    fontSize: 12,
    color: '#8A6D3B',
  },
  row: {
    fontSize: 14,
  },
  fordBox: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  fordRow: {
    fontSize: 14,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 12,
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  cameraBtn: {
    minWidth: 110,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cameraBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  cameraBtnSecondary: {
    backgroundColor: '#334155',
  },
  cameraBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  cameraBtnDisabled: {
    opacity: 0.6,
  },
});
