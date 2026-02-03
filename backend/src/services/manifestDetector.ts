import sharp from 'sharp';
import { ocrRecognize } from './ocrPool';
import { logger } from '../utils/logger';

// Header patterns that indicate a manifest/summary page
const MANIFEST_HEADER_PATTERNS = [
  /Order\s+Customer\s+Type\s+Status/i,
  /Order\s+Date.*Delivery\s+Date/i,
  /Customer.*Type.*Status.*Products/i,
  /Order\s+Site.*Total.*Delivery/i,
];

// Pattern for order IDs (7+ digits followed by 1-2 letters)
const ORDER_ID_PATTERN = /\b\d{7,}[A-Z]{1,2}\b/gi;

// Minimum order IDs to consider it a manifest
const MIN_ORDER_COUNT = 2;

interface ManifestDetectionResult {
  isManifest: boolean;
  text: string;
  confidence: number;
  orderCount: number;
  wasRotated: boolean;
}

/**
 * Detects if a page is a manifest/summary page.
 * Tries 90° CCW rotation if initial OCR confidence is low.
 */
export async function detectManifest(
  imageBuffer: Buffer
): Promise<ManifestDetectionResult> {
  // Try normal orientation first
  let result = await ocrRecognize(imageBuffer);
  let text = result.data.text;
  let confidence = result.data.confidence;
  let wasRotated = false;

  // If confidence is low, try 90° CCW rotation (landscape document)
  if (confidence < 50) {
    const rotated = await sharp(imageBuffer).rotate(270).png().toBuffer();
    const rotatedResult = await ocrRecognize(rotated);

    if (rotatedResult.data.confidence > confidence) {
      text = rotatedResult.data.text;
      confidence = rotatedResult.data.confidence;
      wasRotated = true;
      logger.info('  Manifest detection: 90° CCW rotation improved OCR');
    }
  }

  // Check for manifest patterns
  const hasHeaderPattern = MANIFEST_HEADER_PATTERNS.some((p) => p.test(text));
  const orderMatches = text.match(ORDER_ID_PATTERN) ?? [];
  const orderCount = orderMatches.length;

  const isManifest = hasHeaderPattern || orderCount >= MIN_ORDER_COUNT;

  if (isManifest) {
    logger.info(
      `  Manifest detected: header=${hasHeaderPattern}, orders=${orderCount}, rotated=${wasRotated}`
    );
  }

  return {
    isManifest,
    text,
    confidence,
    orderCount,
    wasRotated,
  };
}

/**
 * Extracts order information from a manifest page.
 */
export function parseManifestOrders(
  text: string
): { order_id: string; customer_name: string }[] {
  const orders: { order_id: string; customer_name: string }[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Match order ID at start of line followed by customer name
    const match = line.match(/^(\d{7,}[A-Z]{1,2})\s+([A-Z][A-Z\s/]+?)(?:\s+SAL|\s+MCR|\s+[A-Z]\s)/i);
    if (match?.[1] && match[2]) {
      orders.push({
        order_id: match[1],
        customer_name: match[2].trim(),
      });
    }
  }

  return orders;
}
