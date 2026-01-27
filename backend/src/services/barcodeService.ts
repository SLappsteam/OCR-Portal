import {
  BarcodeFormat,
  DecodeHintType,
  MultiFormatReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const CODE_39_WRAPPER = /^\*|\*$/g;
const BARCODE_TEXT_PATTERN = /[*"]([A-Z0-9]+)[*"]/;

function createReader(): MultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

async function imageBufferToLuminance(
  imageBuffer: Buffer
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
}

async function detectBarcodeWithZxing(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const { data, width, height } = await imageBufferToLuminance(imageBuffer);
    const luminanceSource = new RGBLuminanceSource(data, width, height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = createReader();
    const result = reader.decode(binaryBitmap);
    return result.getText();
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

    const result = await Tesseract.recognize(cropped, 'eng', {
      logger: () => {},
    });

    const match = result.data.text.match(BARCODE_TEXT_PATTERN);
    if (match?.[1]) {
      logger.debug(`OCR detected barcode text: ${match[1]}`);
      return match[1];
    }
    return null;
  } catch (error) {
    logger.debug('OCR barcode detection failed:', error);
    return null;
  }
}

export async function detectBarcode(
  imageBuffer: Buffer
): Promise<string | null> {
  // Use OCR as primary method (more reliable for scanned documents)
  const ocrResult = await detectBarcodeWithOCR(imageBuffer);
  if (ocrResult) {
    return `*${ocrResult}*`;
  }

  // Fall back to zxing for clean digital barcodes
  const zxingResult = await detectBarcodeWithZxing(imageBuffer);
  if (zxingResult) {
    logger.debug(`Zxing detected barcode: ${zxingResult}`);
    return zxingResult;
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
