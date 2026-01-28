import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger';

const ORIENTATION_CONFIDENCE_THRESHOLD = 15;
const DESKEW_ANGLE_THRESHOLD = 0.5;
const MAX_DESKEW_ANGLE = 10;

interface OrientationResult {
  rotation: number;
  confidence: number;
}

async function sampleRegion(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1700;
  const height = metadata.height ?? 2200;

  const sampleTop = Math.floor(height * 0.25);
  const sampleHeight = Math.floor(height * 0.3);

  return sharp(imageBuffer)
    .extract({ left: 0, top: sampleTop, width, height: sampleHeight })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
}

async function ocrWithConfidence(
  imageBuffer: Buffer
): Promise<{ confidence: number; rotateRadians: number | null }> {
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: () => {},
  });
  return {
    confidence: result.data.confidence,
    rotateRadians: result.data.rotateRadians,
  };
}

export async function detectOrientation(
  imageBuffer: Buffer
): Promise<OrientationResult> {
  try {
    const sample = await sampleRegion(imageBuffer);
    const normal = await ocrWithConfidence(sample);

    if (normal.confidence > 70) {
      return { rotation: 0, confidence: normal.confidence };
    }

    const rotated180 = await sharp(sample).rotate(180).png().toBuffer();
    const flipped = await ocrWithConfidence(rotated180);

    if (flipped.confidence > normal.confidence + ORIENTATION_CONFIDENCE_THRESHOLD) {
      logger.info(
        `Page upside-down: conf ${normal.confidence.toFixed(1)} vs rotated ${flipped.confidence.toFixed(1)}`
      );
      return { rotation: 180, confidence: flipped.confidence };
    }

    return { rotation: 0, confidence: normal.confidence };
  } catch (error) {
    logger.debug('Orientation detection failed, using default', error);
    return { rotation: 0, confidence: 0 };
  }
}

function extractLinesFromBlocks(
  blocks: Tesseract.Block[] | null
): Tesseract.Line[] {
  if (!blocks) return [];
  const lines: Tesseract.Line[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      lines.push(...paragraph.lines);
    }
  }
  return lines;
}

function calculateSkewFromLines(lines: Tesseract.Line[]): number {
  const angles: { angle: number; weight: number }[] = [];

  for (const line of lines) {
    const bl = line.baseline;
    const dx = bl.x1 - bl.x0;
    const dy = bl.y1 - bl.y0;

    if (Math.abs(dx) < 100) continue;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (Math.abs(angle) <= MAX_DESKEW_ANGLE) {
      angles.push({ angle, weight: Math.abs(dx) });
    }
  }

  if (angles.length === 0) return 0;

  const totalWeight = angles.reduce((sum, a) => sum + a.weight, 0);
  return angles.reduce((sum, a) => sum + a.angle * a.weight, 0) / totalWeight;
}

export async function detectSkewAngle(
  imageBuffer: Buffer
): Promise<number> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 1700;
    const height = metadata.height ?? 2200;

    const sampleTop = Math.floor(height * 0.2);
    const sampleHeight = Math.floor(height * 0.5);

    const sample = await sharp(imageBuffer)
      .extract({ left: 0, top: sampleTop, width, height: sampleHeight })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();

    const result = await Tesseract.recognize(sample, 'eng', {
      logger: () => {},
    });

    const lines = extractLinesFromBlocks(result.data.blocks);
    const skew = calculateSkewFromLines(lines);

    if (Math.abs(skew) > DESKEW_ANGLE_THRESHOLD) {
      logger.info(`Skew detected: ${skew.toFixed(2)} degrees`);
    }

    return skew;
  } catch (error) {
    logger.debug('Skew detection failed', error);
    return 0;
  }
}

export async function correctPageImage(
  imageBuffer: Buffer
): Promise<Buffer> {
  const { rotation } = await detectOrientation(imageBuffer);

  let corrected = imageBuffer;
  if (rotation !== 0) {
    corrected = await sharp(corrected).rotate(rotation).png().toBuffer();
  }

  const skewAngle = await detectSkewAngle(corrected);
  if (Math.abs(skewAngle) > DESKEW_ANGLE_THRESHOLD) {
    corrected = await sharp(corrected)
      .rotate(-skewAngle, { background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  }

  return corrected;
}
