import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { extractPageAsPng } from '../tiffService';
import { correctPageImage } from '../imageCorrection';
import { parseFinsalesText, calculateConfidence } from './finsalesParser';
import { parseSummaryText, isSummaryPage } from './summaryParser';
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
    const isSummaryCandidate = page === pageStart + 1;
    const result = await extractSinglePage(
      filePath, page, docTypeCode, isSummaryCandidate
    );
    if (result) {
      results.push(result);
    }
  }

  return results;
}

export async function extractSinglePage(
  filePath: string,
  pageNumber: number,
  docTypeCode: string,
  isSummaryCandidate = false
): Promise<PageExtractionResult | null> {
  try {
    const pageBuffer = await extractPageAsPng(filePath, pageNumber);

    if (isSummaryCandidate) {
      const summaryResult = await tryExtractSummary(pageBuffer, pageNumber, docTypeCode);
      if (summaryResult) return summaryResult;
    }

    const corrected = await correctPageImage(pageBuffer);
    return await extractDetailPage(corrected, pageNumber, docTypeCode);
  } catch (error) {
    logger.error(`Page extraction failed for ${docTypeCode} page ${pageNumber}:`, error);
    return null;
  }
}

async function tryExtractSummary(
  pageBuffer: Buffer,
  pageNumber: number,
  docTypeCode: string
): Promise<PageExtractionResult | null> {
  const rotated = await sharp(pageBuffer).rotate(270).png().toBuffer();
  const rawText = await ocrPage(rotated);

  if (!isSummaryPage(rawText)) {
    return null;
  }

  const orders = parseSummaryText(rawText);
  if (orders.length === 0) {
    return null;
  }

  const confidence = Math.min(orders.length / 5, 1);

  logger.info(
    `Extracted ${docTypeCode} summary page ${pageNumber}: ${orders.length} orders`
  );

  return {
    page_number: pageNumber,
    document_type: docTypeCode,
    fields: { orders } as unknown as PageExtractionResult['fields'],
    confidence,
    raw_text: rawText,
  };
}

async function extractDetailPage(
  imageBuffer: Buffer,
  pageNumber: number,
  docTypeCode: string
): Promise<PageExtractionResult> {
  const rawText = await ocrPage(imageBuffer);
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
}

async function ocrPage(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: () => {},
  });
  return result.data.text;
}
