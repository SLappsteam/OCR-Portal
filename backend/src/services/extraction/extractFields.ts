import Tesseract from 'tesseract.js';
import { extractPageAsPng } from '../tiffService';
import { parseFinsalesText, calculateConfidence } from './finsalesParser';
import { ExtractionResult } from './types';
import { logger } from '../../utils/logger';

const SUPPORTED_DOC_TYPES = ['FINSALES'];

export async function extractDocumentFields(
  filePath: string,
  pageStart: number,
  pageEnd: number,
  docTypeCode: string
): Promise<ExtractionResult | null> {
  if (!SUPPORTED_DOC_TYPES.includes(docTypeCode)) {
    return null;
  }

  const contentPage = pageStart + 1;
  if (contentPage > pageEnd) {
    logger.warn(`No content page for ${docTypeCode} doc (only coversheet)`);
    return null;
  }

  try {
    const pageBuffer = await extractPageAsPng(filePath, contentPage);
    const rawText = await ocrFullPage(pageBuffer);
    const fields = parseFinsalesText(rawText);
    const confidence = calculateConfidence(fields);

    logger.info(
      `Extracted ${docTypeCode} fields: confidence=${(confidence * 100).toFixed(0)}%, ` +
      `order=${fields.order_id}, customer=${fields.customer_name}`
    );

    return {
      document_type: docTypeCode,
      fields,
      confidence,
      raw_text: rawText,
    };
  } catch (error) {
    logger.error(`Field extraction failed for ${docTypeCode}:`, error);
    return null;
  }
}

async function ocrFullPage(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: () => {},
  });
  return result.data.text;
}
