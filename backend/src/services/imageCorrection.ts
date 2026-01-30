import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger';
import { ocrRecognize } from './ocrPool';

const ORIENTATION_CONFIDENCE_THRESHOLD = 10;
const DESKEW_ANGLE_THRESHOLD = 0.5;
const MAX_DESKEW_ANGLE = 10;

async function sampleUnifiedRegion(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1700;
  const height = metadata.height ?? 2200;

  const sampleTop = Math.floor(height * 0.2);
  const sampleHeight = Math.floor(height * 0.35);

  return sharp(imageBuffer)
    .extract({ left: 0, top: sampleTop, width, height: sampleHeight })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
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

export async function correctPageImage(
  imageBuffer: Buffer
): Promise<Buffer> {
  try {
    const sample = await sampleUnifiedRegion(imageBuffer);
    const normalResult = await ocrRecognize(sample);

    let rotation = 0;
    let skewBlocks = normalResult.data.blocks;

    if (normalResult.data.confidence <= 70) {
      const rotated180 = await sharp(sample).rotate(180).png().toBuffer();
      const flippedResult = await ocrRecognize(rotated180);

      if (flippedResult.data.confidence > normalResult.data.confidence + ORIENTATION_CONFIDENCE_THRESHOLD) {
        logger.info(
          `Page upside-down: conf ${normalResult.data.confidence.toFixed(1)} vs rotated ${flippedResult.data.confidence.toFixed(1)}`
        );
        rotation = 180;
        skewBlocks = flippedResult.data.blocks;
      }
    }

    let corrected = imageBuffer;
    if (rotation !== 0) {
      corrected = await sharp(corrected).rotate(rotation).png().toBuffer();
    }

    const lines = extractLinesFromBlocks(skewBlocks);
    const skew = calculateSkewFromLines(lines);

    if (Math.abs(skew) > DESKEW_ANGLE_THRESHOLD) {
      logger.info(`Skew detected: ${skew.toFixed(2)} degrees`);
      corrected = await sharp(corrected)
        .rotate(-skew, { background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
    }

    return corrected;
  } catch (error) {
    logger.debug('Image correction failed, returning original', error);
    return imageBuffer;
  }
}
