import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import CodeEntry from '../components/CodeEntry';
import ConfirmDialog from '../components/ConfirmDialog';
import PhotoStrip from '../components/PhotoStrip';
import Button from '../components/Button';
import damageAreas from '../data/damageAreas.json';
import damageTypes from '../data/damageTypes.json';
import severity from '../data/severity.json';
import {
  addCode,
  addPhoto,
  computeTop5Area,
  computeTop5Type,
  createReport,
  deleteReport,
  findDuplicateVinCodeMatch,
  getReportDetail,
  getSettings,
  markReportDraftOpened,
  removeCode,
  removePhoto,
  updateReportFields,
} from '../db/queries';
import { openEmailDraft } from '../lib/email';
import { cleanupTempFiles, compressPhotosForEmail, fileExists, saveCapturedPhoto } from '../lib/images';
import { extractVinFromImage, hasVinAmbiguousChars, normalizeVinLight } from '../lib/ocr';
import { useThemeContext } from '../lib/theme';
import { detectManufacturerGroupFromVin, prefillMakeModelFromVin } from '../lib/vin';
import { CodeOption, ReportCodeRow, ReportPhotoRow, ReportStatus } from '../types/models';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportEditor'>;

const AREA_OPTIONS = damageAreas as CodeOption[];
const TYPE_OPTIONS = damageTypes as CodeOption[];
const SEVERITY_OPTIONS = severity as CodeOption[];

type CameraMode = 'vin' | 'general';
interface AttachmentPlanItem {
  sourceUri: string;
  targetFileName: string;
}

function sanitizeFileToken(value: string, fallback: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  return cleaned || fallback;
}

export default function ReportEditorScreen({ navigation, route }: Props) {
  const { theme } = useThemeContext();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reportId, setReportId] = useState<string | null>(route.params?.reportId ?? null);
  const [status, setStatus] = useState<ReportStatus>('incomplete');

  const [vinText, setVinText] = useState('');
  const [makeText, setMakeText] = useState('');
  const [modelText, setModelText] = useState('');
  const [unitLocation, setUnitLocation] = useState('');
  const [recipients, setRecipients] = useState('');
  const [notes, setNotes] = useState('');
  const [codes, setCodes] = useState<ReportCodeRow[]>([]);
  const [photos, setPhotos] = useState<ReportPhotoRow[]>([]);
  const makeEditedRef = useRef(false);
  const modelEditedRef = useRef(false);
  const vinPrefillSeqRef = useRef(0);
  const lastPrefilledVinRef = useRef('');

  const [topAreaCodes, setTopAreaCodes] = useState<string[]>([]);
  const [topTypeCodes, setTopTypeCodes] = useState<string[]>([]);

  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('general');
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);

  const askConfirm = useCallback((message: string) => {
    setConfirmMessage(message);
    setConfirmVisible(true);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const resolveConfirm = (value: boolean) => {
    setConfirmVisible(false);
    const resolver = confirmResolver.current;
    confirmResolver.current = null;
    resolver?.(value);
  };

  const vinPhoto = useMemo(() => photos.find((p) => p.is_vin === 1) ?? null, [photos]);
  const otherPhotos = useMemo(() => photos.filter((p) => p.is_vin === 0), [photos]);
  const normalizedVin = useMemo(() => normalizeVinLight(vinText), [vinText]);
  const vinHasAmbiguousChars = useMemo(() => hasVinAmbiguousChars(vinText), [vinText]);

  const buildAttachmentPlan = useCallback((): AttachmentPlanItem[] => {
    if (!vinPhoto) {
      return [];
    }
    const nonVinPhotos = photos
      .filter((item) => item.is_vin === 0)
      .sort((a, b) => a.created_at - b.created_at);
    const locationToken = sanitizeFileToken(unitLocation, 'NOLOC');
    const vinToken = sanitizeFileToken(normalizedVin, 'VIN');

    return [
      {
        sourceUri: vinPhoto.uri,
        targetFileName: 'VIN_photo.jpg',
      },
      ...nonVinPhotos.map((item, index) => ({
        sourceUri: item.uri,
        targetFileName: `${vinToken}_${locationToken}_${index + 1}.jpg`,
      })),
    ];
  }, [vinPhoto, photos, unitLocation, normalizedVin]);

  const attachmentPreviewNames = useMemo(
    () => buildAttachmentPlan().map((item) => item.targetFileName),
    [buildAttachmentPlan]
  );

  const loadTopLists = useCallback(async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [areas, types] = await Promise.all([computeTop5Area(cutoff), computeTop5Type(cutoff)]);
    setTopAreaCodes(areas);
    setTopTypeCodes(types);
  }, []);

  const loadReport = useCallback(async (id: string) => {
    const detail = await getReportDetail(id);
    if (!detail) {
      throw new Error('Report not found.');
    }

    setReportId(detail.id);
    setStatus(detail.status);
    setVinText(detail.vin_text);
    setMakeText(detail.make_text || '');
    setModelText(detail.model_text || '');
    setUnitLocation(detail.unit_location);
    setRecipients(detail.recipients);
    setNotes(detail.notes);
    setCodes(detail.codes);
    setPhotos(detail.photos);
    makeEditedRef.current = Boolean(detail.make_text?.trim());
    modelEditedRef.current = Boolean(detail.model_text?.trim());
    lastPrefilledVinRef.current = normalizeVinLight(detail.vin_text || '');
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      await loadTopLists();

      const existingId = route.params?.reportId;
      if (existingId) {
        await loadReport(existingId);
      } else {
        const settings = await getSettings();
        const created = await createReport('incomplete');
        await updateReportFields(created.id, { recipients: settings.default_recipients || '' });
        await loadReport(created.id);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadReport, loadTopLists, route.params?.reportId]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (normalizedVin.length < 3) {
      return;
    }
    if (normalizedVin === lastPrefilledVinRef.current) {
      return;
    }

    const seq = ++vinPrefillSeqRef.current;
    lastPrefilledVinRef.current = normalizedVin;
    void (async () => {
      const prefill = await prefillMakeModelFromVin(normalizedVin);
      if (vinPrefillSeqRef.current !== seq) {
        return;
      }
      if (!makeEditedRef.current) {
        setMakeText(prefill.make.trim());
      }
      if (!modelEditedRef.current) {
        setModelText(prefill.model.trim());
      }
    })();
  }, [normalizedVin]);

  const persistFields = useCallback(
    async (nextStatus?: ReportStatus) => {
      if (!reportId) {
        return;
      }

      const finalStatus = nextStatus ?? status;
      await updateReportFields(reportId, {
        status: finalStatus,
        vin_text: normalizeVinLight(vinText),
        make_text: makeText.trim(),
        model_text: modelText.trim(),
        unit_location: unitLocation,
        manufacturer_group: detectManufacturerGroupFromVin(vinText),
        recipients,
        notes,
      });
      setStatus(finalStatus);
    },
    [reportId, status, vinText, makeText, modelText, unitLocation, recipients, notes]
  );

  const handleAddCode = async (code: string) => {
    if (!reportId) {
      return;
    }
    const row = await addCode(reportId, code);
    setCodes((prev) => [...prev, row]);
  };

  const handleRemoveCode = async (codeId: string) => {
    await removeCode(codeId);
    setCodes((prev) => prev.filter((item) => item.id !== codeId));
  };

  const handleDeletePhoto = async (photoId: string) => {
    await removePhoto(photoId);
    setPhotos((prev) => prev.filter((item) => item.id !== photoId));
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    if (permission?.granted) {
      return true;
    }

    const result = await requestPermission();
    return result.granted;
  };

  const ensureMediaPermission = async (): Promise<boolean> => {
    if (mediaPermission?.granted) {
      return true;
    }

    const result = await requestMediaPermission();
    return result.granted;
  };

  const openCamera = async (mode: CameraMode) => {
    const granted = await ensureCameraPermission();
    if (!granted) {
      Alert.alert('Camera permission required', 'Enable camera access to capture photos.');
      return;
    }

    setCameraMode(mode);
    setCameraReady(false);
    setCameraVisible(true);
  };

  const addVinPhotoFromUri = async (sourceUri: string) => {
    if (!reportId) {
      Alert.alert('Report not ready', 'Please close and re-open this report, then try again.');
      return;
    }

    const savedUri = await saveCapturedPhoto(sourceUri, true);
    const existingVin = photos.find((item) => item.is_vin === 1);
    if (existingVin) {
      await removePhoto(existingVin.id);
    }

    const row = await addPhoto(reportId, savedUri, true);
    setPhotos((prev) => [...prev.filter((item) => item.is_vin !== 1), row]);

    const extracted = await extractVinFromImage(savedUri);
    if (extracted) {
      setVinText(normalizeVinLight(extracted));
    }
  };

  const addDamagePhotoFromUri = async (sourceUri: string) => {
    if (!reportId) {
      Alert.alert('Report not ready', 'Please close and re-open this report, then try again.');
      return;
    }

    const savedUri = await saveCapturedPhoto(sourceUri, false);
    const row = await addPhoto(reportId, savedUri, false);
    setPhotos((prev) => [...prev, row]);
  };

  const pickVinFromGallery = async () => {
    const granted = await ensureMediaPermission();
    if (!granted) {
      Alert.alert('Gallery permission required', 'Enable photo library access to pick VIN photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets.length) {
        return;
      }
      await addVinPhotoFromUri(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Gallery pick failed', (error as Error).message);
    }
  };

  const pickDamagePhotosFromGallery = async () => {
    const granted = await ensureMediaPermission();
    if (!granted) {
      Alert.alert('Gallery permission required', 'Enable photo library access to pick damage photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets.length) {
        return;
      }

      for (const asset of result.assets) {
        await addDamagePhotoFromUri(asset.uri);
      }
    } catch (error) {
      Alert.alert('Gallery pick failed', (error as Error).message);
    }
  };

  const capturePhoto = async () => {
    if (!reportId) {
      Alert.alert('Report not ready', 'Please close and re-open this report, then try again.');
      return;
    }

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

      if (cameraMode === 'vin') {
        await addVinPhotoFromUri(photo.uri);
        setCameraVisible(false);
      } else {
        await addDamagePhotoFromUri(photo.uri);
      }
    } catch (error) {
      Alert.alert('Capture failed', (error as Error).message);
    } finally {
      setCameraBusy(false);
    }
  };

  const saveDefaultsToRecipients = async () => {
    const settings = await getSettings();
    setRecipients(settings.default_recipients || '');
  };

  const onSave = async () => {
    if (!reportId) {
      return;
    }

    setWorking(true);
    try {
      if (status === 'completed') {
        await persistFields('completed');
        Alert.alert('Saved', 'Completed report changes saved.');
      } else {
        await persistFields('incomplete');
        navigation.navigate('Home');
      }
    } catch (error) {
      Alert.alert('Save failed', (error as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const onDeleteReport = () => {
    if (!reportId) {
      return;
    }
    Alert.alert('Delete report?', 'This report and its stored files will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteReport(reportId);
            navigation.navigate('Home');
          })();
        },
      },
    ]);
  };

  const onCreateDraft = async () => {
    if (!reportId) {
      return;
    }

    const vinTrimmed = normalizeVinLight(vinText);
    setVinText(vinTrimmed);
    if (!vinTrimmed) {
      Alert.alert('VIN required', 'VIN is required before creating an email draft.');
      return;
    }

    if (!vinPhoto) {
      Alert.alert('VIN photo required', 'Capture a VIN photo before creating an email draft.');
      return;
    }

    const vinExists = await fileExists(vinPhoto.uri);
    if (!vinExists) {
      Alert.alert('VIN photo missing', 'VIN photo file is missing. Capture it again before drafting.');
      return;
    }

    const duplicate = await findDuplicateVinCodeMatch({
      currentReportId: reportId,
      vinText: vinTrimmed,
      codes: codes.map((item) => item.code),
    });
    if (duplicate) {
      const choice = await new Promise<'proceed' | 'review' | 'cancel'>((resolve) => {
        Alert.alert(
          'Possible duplicate report',
          `VIN ${vinTrimmed} has overlapping code(s): ${duplicate.overlappingCodes.join(', ')}.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
            { text: 'Review Previous Entry', onPress: () => resolve('review') },
            { text: 'Yes, Continue', onPress: () => resolve('proceed') },
          ]
        );
      });
      if (choice === 'cancel') {
        return;
      }
      if (choice === 'review') {
        navigation.navigate('ReportEditor', { reportId: duplicate.report.id });
        return;
      }
    }

    if (codes.length === 0) {
      const proceed = await askConfirm('Are you sure you want to proceed without damage codes?');
      if (!proceed) {
        return;
      }
    }

    if (!unitLocation.trim()) {
      const proceed = await askConfirm('Are you sure you want to proceed without unit location?');
      if (!proceed) {
        return;
      }
    }

    if (!makeText.trim()) {
      const proceed = await askConfirm('Are you sure you want to proceed without make?');
      if (!proceed) {
        return;
      }
    }

    if (!modelText.trim()) {
      const proceed = await askConfirm('Are you sure you want to proceed without model?');
      if (!proceed) {
        return;
      }
    }

    if (photos.length > 12) {
      const proceed = await askConfirm('Many photos may exceed email limits; consider fewer photos. Proceed anyway?');
      if (!proceed) {
        return;
      }
    }

    setWorking(true);
    let tempAttachments: string[] = [];

    try {
      await persistFields(status);
      await updateReportFields(reportId, {
        manufacturer_group: detectManufacturerGroupFromVin(vinTrimmed),
      });

      const attachmentPlan = buildAttachmentPlan();
      const { compressed, missingUris } = await compressPhotosForEmail(attachmentPlan);
      tempAttachments = compressed.map((item) => item.targetUri);

      if (missingUris.includes(vinPhoto.uri)) {
        Alert.alert('VIN photo missing', 'VIN photo file is missing after processing. Capture it again.');
        return;
      }

      if (missingUris.length > 0) {
        Alert.alert(
          'Some photos were skipped',
          `${missingUris.length} missing file(s) were not attached.`
        );
      }

      await openEmailDraft({
        recipientsText: recipients,
        vinText: vinTrimmed,
        unitLocation: unitLocation.trim(),
        notes,
        codes: codes.map((item) => item.code),
        photoCount: photos.length,
        attachments: compressed.map((item) => item.targetUri),
      });

      await markReportDraftOpened(reportId);
      setStatus('completed');
      if (Platform.OS === 'android') {
        ToastAndroid.show('Draft opened in email app.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Success', 'Draft opened in email app.');
      }
      navigation.replace('DraftSuccess', { reportId });
    } catch (error) {
      Alert.alert('Draft failed', (error as Error).message);
    } finally {
      await cleanupTempFiles(tempAttachments);
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}> 
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.text }]}>VIN</Text>
          <TextInput
            value={vinText}
            onChangeText={setVinText}
            placeholder="Type last 8 (manual) or scan VIN photo"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            autoCapitalize="characters"
          />
          {vinHasAmbiguousChars ? (
            <View
              style={[
                styles.vinWarningWrap,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? '#2F2612' : '#FFF8E1',
                },
              ]}
            >
              <Text style={[styles.vinWarningText, { color: theme.isDark ? '#FFD28A' : '#8A6D3B' }]}>
                OCR note: VINs cannot contain I, O, or Q. Review highlighted characters before drafting.
              </Text>
              <Text style={[styles.vinPreview, { color: theme.text }]}>
                {normalizedVin.split('').map((char, index) => (
                  <Text
                    key={`${char}-${index}`}
                    style={/[IOQ]/.test(char) ? styles.vinSuspectChar : undefined}
                  >
                    {char}
                  </Text>
                ))}
              </Text>
            </View>
          ) : null}
          <View style={styles.inlineButtons}>
            <Button
              title="Capture VIN Photo (OCR)"
              onPress={() => void openCamera('vin')}
              style={styles.inlineButton}
            />
            <Button
              title="Choose VIN Photo"
              onPress={() => void pickVinFromGallery()}
              variant="secondary"
              style={styles.inlineButton}
            />
          </View>
          <PhotoStrip
            title="VIN Photo"
            photos={vinPhoto ? [vinPhoto] : []}
            onDelete={(id) => void handleDeletePhoto(id)}
            emptyText="No VIN photo captured."
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Unit Location</Text>
          <TextInput
            value={unitLocation}
            onChangeText={setUnitLocation}
            placeholder="hmc e35"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, styles.locationInput, { borderColor: theme.border, color: theme.text }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Make / Model</Text>
          <View style={styles.inlineButtons}>
            <TextInput
              value={makeText}
              onChangeText={(value) => {
                makeEditedRef.current = value.trim().length > 0;
                setMakeText(value);
              }}
              placeholder="Make (auto-fill when VIN resolves)"
              placeholderTextColor={theme.mutedText}
              style={[styles.input, styles.inlineButton, { borderColor: theme.border, color: theme.text }]}
            />
            <TextInput
              value={modelText}
              onChangeText={(value) => {
                modelEditedRef.current = value.trim().length > 0;
                setModelText(value);
              }}
              placeholder="Model (auto-fill when available)"
              placeholderTextColor={theme.mutedText}
              style={[styles.input, styles.inlineButton, { borderColor: theme.border, color: theme.text }]}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Photos</Text>
          <View style={styles.inlineButtons}>
            <Button title="Add Photos" onPress={() => void openCamera('general')} style={styles.inlineButton} />
            <Button
              title="Add From Gallery"
              onPress={() => void pickDamagePhotosFromGallery()}
              variant="secondary"
              style={styles.inlineButton}
            />
          </View>
          <PhotoStrip
            title="Damage Photos"
            photos={otherPhotos}
            onDelete={(id) => void handleDeletePhoto(id)}
            emptyText="No damage photos yet."
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <CodeEntry
            codes={codes}
            areaOptions={AREA_OPTIONS}
            typeOptions={TYPE_OPTIONS}
            severityOptions={SEVERITY_OPTIONS}
            topAreaCodes={topAreaCodes}
            topTypeCodes={topTypeCodes}
            onAddCode={handleAddCode}
            onRemoveCode={handleRemoveCode}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Optional notes"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, styles.notesInput, { borderColor: theme.border, color: theme.text }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipients</Text>
          <TextInput
            value={recipients}
            onChangeText={setRecipients}
            placeholder="email1@example.com;email2@example.com"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            autoCapitalize="none"
          />
          <Button title="Reset to defaults" onPress={() => void saveDefaultsToRecipients()} variant="secondary" />
        </View>

        <View style={[styles.reminder, { backgroundColor: theme.isDark ? '#0E2A4C' : '#E8F2FF', borderColor: theme.border }]}> 
          <Text style={[styles.reminderTitle, { color: theme.primary }]}>Photo Reminder</Text>
          <Text style={[styles.reminderText, { color: theme.text }]}>Reminder: include (1) wide shot showing bay/location, (2) closeups of damage, (3) VIN photo.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Attachment Preview</Text>
          {attachmentPreviewNames.length === 0 ? (
            <Text style={{ color: theme.mutedText, fontSize: 13 }}>
              No attachment filenames yet. Capture VIN photo first.
            </Text>
          ) : (
            <View style={styles.attachmentList}>
              {attachmentPreviewNames.map((name) => (
                <Text key={name} style={[styles.attachmentItem, { color: theme.text }]}>
                  {name}
                </Text>
              ))}
            </View>
          )}
        </View>

        {status === 'completed' ? (
          <Text style={[styles.completedLabel, { color: theme.primary }]}>Completed report. You can edit and draft again.</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={status === 'completed' ? 'Save Changes' : 'Save Incomplete'}
            onPress={() => void onSave()}
            loading={working}
            variant="secondary"
          />
          <Button
            title={status === 'completed' ? 'Draft Email Again' : 'Create Email Draft'}
            onPress={() => void onCreateDraft()}
            loading={working}
          />
          <Button title="Delete Report" onPress={onDeleteReport} variant="danger" />
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
            <Text style={styles.cameraTitle}>
              {cameraMode === 'vin' ? 'Capture VIN Photo' : 'Add Photos'}
            </Text>
            <View style={styles.cameraButtons}>
              <Pressable
                style={[styles.cameraBtn, styles.cameraBtnSecondary]}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={styles.cameraBtnText}>Done</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.cameraBtn,
                  styles.cameraBtnPrimary,
                  (!cameraReady || cameraBusy) && styles.cameraBtnDisabled,
                ]}
                onPress={() => void capturePhoto()}
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

      <ConfirmDialog
        visible={confirmVisible}
        message={confirmMessage}
        confirmLabel="Proceed"
        cancelLabel="Cancel"
        onConfirm={() => resolveConfirm(true)}
        onCancel={() => resolveConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  locationInput: {
    width: '60%',
    minWidth: 140,
  },
  notesInput: {
    minHeight: 110,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineButton: {
    flex: 1,
  },
  vinWarningWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  vinWarningText: {
    fontSize: 12,
    lineHeight: 17,
  },
  vinPreview: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vinSuspectChar: {
    color: '#C62828',
    textDecorationLine: 'underline',
  },
  reminder: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  reminderText: {
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentList: {
    gap: 4,
  },
  attachmentItem: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  completedLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    marginTop: 2,
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
