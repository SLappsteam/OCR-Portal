import Tesseract from 'tesseract.js';
import { extractPageAsPng } from '../tiffService';
import { correctPageImage } from '../imageCorrection';
import { parseFinsalesText, calculateConfidence } from './finsalesParser';
import { PageExtractionResult } from './types';
import { logger } from '../../utils/logger';

const SUPPORTED_DOC_TYPES = ['FINSALES'];

export async function extractAllPages(
  filePath: string,
  pageStart: number,
  pageEnd: number,
  docTypeCode: string
): Promise<PageExtractionResult[]> {
  if (!SUPPORTED_DOC_TYPES.includes(docTypeCode)) {
    return [];
  }

  const results: PageExtractionResult[] = [];

  for (let page = pageStart + 1; page <= pageEnd; page++) {
    const result = await extractSinglePage(filePath, page, docTypeCode);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

export async function extractSinglePage(
  filePath: string,
  pageNumber: number,
  docTypeCode: string
): Promise<PageExtractionResult | null> {
  try {
    const pageBuffer = await extractPageAsPng(filePath, pageNumber);
    const corrected = await correctPageImage(pageBuffer);
    const rawText = await ocrFullPage(corrected);
    const fields = parseFinsalesText(rawText);
    const confidence = calculateConfidence(fields);

    logger.info(
      `Extracted ${docTypeCode} page ${pageNumber}: confidence=${(confidence * 100).toFixed(0)}%, ` +
      `order=${fields.order_id}, customer=${fields.customer_name}`
    );

    return {
      page_number: pageNumber,
      document_type: docTypeCode,
      fields,
      confidence,
      raw_text: rawText,
    };
  } catch (error) {
    logger.error(`Page extraction failed for ${docTypeCode} page ${pageNumber}:`, error);
    return null;
  }
}

async function ocrFullPage(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: () => {},
  });
  return result.data.text;
}
