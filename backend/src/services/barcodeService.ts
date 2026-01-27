import {
  BarcodeFormat,
  DecodeHintType,
  MultiFormatReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const CODE_39_WRAPPER = /^\*|\*$/g;

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

export async function detectBarcode(
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
