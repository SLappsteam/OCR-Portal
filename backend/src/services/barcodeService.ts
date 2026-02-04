import sharp from 'sharp';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ocrRecognize } from './ocrPool';

const CODE_39_WRAPPER = /^\*|\*$/g;
const OCR_NOISE_CHARS = /[^A-Z0-9]/g;
// Pattern handles OCR errors: * can be misread as ~, ), *, ", etc.
// Content allows OCR noise chars (?, !, .) that get stripped during cleanup.
const BARCODE_TEXT_PATTERN = /[*"'+]([A-Z0-9][A-Z0-9?!.,;: ]{1,11})[*"'~?)\]|]/;

/** Convert Node.js Buffer to a plain ArrayBuffer (for zbar-wasm) */
function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

let scanRgba: typeof import('@undecaf/zbar-wasm').scanRGBABuffer;

async function getZbarScanner() {
  if (!scanRgba) {
    const zbar = await import('@undecaf/zbar-wasm');
    scanRgba = zbar.scanRGBABuffer;
  }
  return scanRgba;
}

async function cropForBarcode(
  imageBuffer: Buffer
): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1700;
  const height = metadata.height ?? 2200;

  const cropTop = Math.floor(height * 0.25);
  const cropHeight = Math.floor(height * 0.25);

  const { data, info } = await sharp(imageBuffer)
    .extract({ left: 0, top: cropTop, width, height: cropHeight })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: bufferToArrayBuffer(data),
    width: info.width,
    height: info.height,
  };
}

async function detectBarcodeWithZbar(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const scan = await getZbarScanner();
    const { data, width, height } = await cropForBarcode(imageBuffer);
    const results = await scan(data, width, height);
    const first = results[0];
    if (first) {
      return first.decode();
    }
    return null;
  } catch {
    return null;
  }
}

async function detectBarcodeWithOCR(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 1700;
    const height = metadata.height ?? 2200;

    // Crop to barcode label region (upper portion where coversheet text is)
    const cropTop = Math.floor(height * 0.35);
    const cropHeight = Math.floor(height * 0.15);
    const cropped = await sharp(imageBuffer)
      .extract({ left: 0, top: cropTop, width, height: cropHeight })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();

    const result = await ocrRecognize(cropped);

    const rawText = result.data.text.trim();
    const match = rawText.match(BARCODE_TEXT_PATTERN);
    if (match?.[1]) {
      const cleaned = match[1].replace(OCR_NOISE_CHARS, '');
      if (cleaned.length >= 2) {
        logger.info(`  OCR barcode match: raw="${match[0]}" -> cleaned="${cleaned}"`);
        return cleaned;
      }
      logger.info(`  OCR matched "${match[0]}" but cleaned too short: "${cleaned}"`);
    }
    return null;
  } catch (error) {
    logger.warn('OCR barcode detection failed:', error);
    return null;
  }
}

export async function scanBarcodeInRegion(
  imageBuffer: Buffer,
  topPct: number,
  heightPct: number
): Promise<string | null> {
  try {
    const scan = await getZbarScanner();
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 1700;
    const height = metadata.height ?? 2200;

    const cropTop = Math.floor(height * topPct);
    const cropHeight = Math.min(
      Math.floor(height * heightPct),
      height - cropTop
    );

    const { data, info } = await sharp(imageBuffer)
      .extract({ left: 0, top: cropTop, width, height: cropHeight })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const results = await scan(bufferToArrayBuffer(data), info.width, info.height);

    const first = results[0];
    return first ? first.decode() : null;
  } catch {
    return null;
  }
}

export async function detectBarcode(
  imageBuffer: Buffer
): Promise<string | null> {
  // Fast path: zbar on both orientations (~40ms total)
  const zbarResult = await detectBarcodeWithZbar(imageBuffer);
  if (zbarResult) {
    logger.info(`  Zbar detected barcode: ${zbarResult}`);
    return `*${zbarResult}*`;
  }

  const rotated = await sharp(imageBuffer).rotate(180).png().toBuffer();
  const zbarRotated = await detectBarcodeWithZbar(rotated);
  if (zbarRotated) {
    logger.info(`  Zbar detected barcode (180°): ${zbarRotated}`);
    return `*${zbarRotated}*`;
  }

  // Slow path: OCR on both orientations (~2-4s)
  const ocrResult = await detectBarcodeWithOCR(imageBuffer);
  if (ocrResult) {
    return `*${ocrResult}*`;
  }

  const ocrRotated = await detectBarcodeWithOCR(rotated);
  if (ocrRotated) {
    logger.info(`  OCR barcode found on 180° rotation`);
    return `*${ocrRotated}*`;
  }

  return null;
}

export function normalizeBarcode(raw: string): string {
  return raw.replace(CODE_39_WRAPPER, '').toUpperCase();
}

export async function isValidDocumentType(code: string): Promise<boolean> {
  const docType = await prisma.documentType.findUnique({
    where: { code },
    select: { is_active: true },
  });
  return docType?.is_active ?? false;
}

export async function getDocumentTypeByCode(
  code: string
): Promise<{ id: number; code: string } | null> {
  return prisma.documentType.findUnique({
    where: { code },
    select: { id: true, code: true },
  });
}
