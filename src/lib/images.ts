import * as FileSystem from 'expo-file-system/legacy';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Image } from 'react-native';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.75;

export const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}damagedraft/photos/`;
export const TEMP_DIR = `${FileSystem.cacheDirectory ?? ''}damagedraft/tmp/`;

export interface EmailAttachmentInput {
  sourceUri: string;
  targetFileName: string;
}

export interface EmailAttachmentOutput {
  sourceUri: string;
  targetUri: string;
  targetFileName: string;
}

function fileExtFromUri(uri: string): string {
  const clean = uri.split('?')[0];
  const last = clean.split('.').pop();
  if (!last) {
    return 'jpg';
  }
  const lower = last.toLowerCase();
  return lower === 'png' ? 'png' : 'jpg';
}

function makeFileName(prefix: string, ext: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
}

function ensureJpgFileName(fileName: string): string {
  const clean = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  if (clean.toLowerCase().endsWith('.jpg')) {
    return clean;
  }
  if (clean.toLowerCase().endsWith('.jpeg')) {
    return clean.slice(0, -5) + '.jpg';
  }
  return `${clean}.jpg`;
}

async function ensureDir(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

export async function saveCapturedPhoto(sourceUri: string, isVin: boolean): Promise<string> {
  await ensureDir(PHOTO_DIR);
  const ext = fileExtFromUri(sourceUri);
  const fileName = makeFileName(isVin ? 'vin' : 'photo', ext);
  const destination = `${PHOTO_DIR}${fileName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function compressPhotoForEmail(
  sourceUri: string,
  targetFileName?: string
): Promise<string | null> {
  const exists = await fileExists(sourceUri);
  if (!exists) {
    return null;
  }

  await ensureDir(TEMP_DIR);

  let width = 0;
  let height = 0;
  try {
    const size = await getImageSize(sourceUri);
    width = size.width;
    height = size.height;
  } catch {
    // If size resolution fails, still try compression without resize.
  }

  const shouldResize = width > 0 && height > 0 && Math.max(width, height) > MAX_EDGE;
  const actions = shouldResize
    ? [
        {
          resize: width >= height
            ? { width: MAX_EDGE }
            : { height: MAX_EDGE },
        } as const,
      ]
    : [];

  const result = await manipulateAsync(sourceUri, actions, {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  const outputName = targetFileName ? ensureJpgFileName(targetFileName) : makeFileName('email', 'jpg');
  const destination = `${TEMP_DIR}${outputName}`;
  await FileSystem.copyAsync({ from: result.uri, to: destination });
  return destination;
}

export async function compressPhotosForEmail(
  items: EmailAttachmentInput[]
): Promise<{
  compressed: EmailAttachmentOutput[];
  missingUris: string[];
}> {
  const compressed: EmailAttachmentOutput[] = [];
  const missingUris: string[] = [];

  for (const item of items) {
    const compressedUri = await compressPhotoForEmail(item.sourceUri, item.targetFileName);
    if (!compressedUri) {
      missingUris.push(item.sourceUri);
      continue;
    }
    compressed.push({
      sourceUri: item.sourceUri,
      targetUri: compressedUri,
      targetFileName: item.targetFileName,
    });
  }

  return { compressed, missingUris };
}

export async function cleanupTempFiles(uris: string[]): Promise<void> {
  for (const uri of uris) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // best-effort cleanup only
    }
  }
}

export async function deleteFileBestEffort(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort cleanup only
  }
}
