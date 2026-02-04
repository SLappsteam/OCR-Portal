import sharp from 'sharp';
import { ocrRecognize } from '../services/ocrPool';
import { logger } from './logger';

const DEFAULT_CONFIDENCE_THRESHOLD = 50;
const ROTATION_IMPROVEMENT_MARGIN = 10;

export interface OcrResult {
  text: string;
  confidence: number;
  buffer: Buffer;
  data: Awaited<ReturnType<typeof ocrRecognize>>['data'] | null;
}

/**
 * Perform OCR on a buffer, returning text and confidence.
 */
export async function performOcr(
  buffer: Buffer
): Promise<{ text: string; confidence: number; data: Awaited<ReturnType<typeof ocrRecognize>>['data'] }> {
  const result = await ocrRecognize(buffer);
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    data: result.data,
  };
}

/**
 * Perform OCR with automatic 180-degree rotation retry when confidence is low.
 * Returns the best result between the normal and rotated orientations.
 */
export async function ocrWithRotationRetry(
  buffer: Buffer,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  improvementMargin = ROTATION_IMPROVEMENT_MARGIN
): Promise<OcrResult> {
  const normal = await performOcr(buffer);
  let best: OcrResult = {
    text: normal.text,
    confidence: normal.confidence,
    buffer,
    data: normal.data,
  };

  if (normal.confidence < confidenceThreshold) {
    const flipped = await sharp(buffer).rotate(180).png().toBuffer();
    const flippedOcr = await performOcr(flipped);

    if (flippedOcr.confidence > normal.confidence + improvementMargin) {
      logger.info(
        `Page upside-down: conf ${normal.confidence.toFixed(1)} ` +
        `vs rotated ${flippedOcr.confidence.toFixed(1)}`
      );
      best = {
        text: flippedOcr.text,
        confidence: flippedOcr.confidence,
        buffer: flipped,
        data: flippedOcr.data,
      };
    }
  }

  return best;
}
