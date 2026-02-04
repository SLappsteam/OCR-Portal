import sharp from 'sharp';
import { extractPageAsPng } from '../tiffService';
import { correctPageImage } from '../imageCorrection';
import { ocrRecognize } from '../ocrPool';
import { parseFinsalesPage, calculateConfidence } from './finsalesParser';
import { parseSummaryText, isSummaryPage, SummaryOrder } from './summaryParser';
import { isTicketPage, parseTicketText, calculateTicketConfidence } from './ticketParser';
import {
  isTransactionReceipt,
  parseTransactionReceipt,
  calculateReceiptConfidence,
} from './transactionReceiptParser';
import {
  isCdrReport,
  parseCdrReport,
  calculateCdrConfidence,
} from './cdrReportParser';
import { scanBarcodeInRegion } from '../barcodeService';
import { PageExtractionResult, PageFields } from './types';
import { logger } from '../../utils/logger';

// Batch types that support invoice extraction
const INVOICE_BATCH_TYPES = ['FINSALES', 'FINTRAN', 'CDR', 'LOFTFIN'];
const LOW_CONFIDENCE_THRESHOLD = 50;
const PAGE_CONCURRENCY = 4;

export async function extractAllPages(
  filePath: string,
  pageStart: number,
  pageEnd: number,
  batchTypeCode: string
): Promise<PageExtractionResult[]> {
  if (!INVOICE_BATCH_TYPES.includes(batchTypeCode)) {
    return [];
  }

  const pageNumbers: number[] = [];
  for (let page = pageStart + 1; page <= pageEnd; page++) {
    pageNumbers.push(page);
  }

  const results: PageExtractionResult[] = [];
  for (let i = 0; i < pageNumbers.length; i += PAGE_CONCURRENCY) {
    const batch = pageNumbers.slice(i, i + PAGE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((page) => {
        const isSummary = page === pageStart + 1;
        return extractSinglePage(filePath, page, batchTypeCode, isSummary);
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
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
    let { text: rawText, confidence: ocrConf } = await ocrPageWithConfidence(corrected);
    let activeBuffer = corrected;

    if (ocrConf < LOW_CONFIDENCE_THRESHOLD) {
      const flipped = await sharp(corrected).rotate(180).png().toBuffer();
      const flippedResult = await ocrPageWithConfidence(flipped);
      if (flippedResult.confidence > ocrConf + 10) {
        logger.info(
          `Page ${pageNumber}: low OCR confidence (${ocrConf.toFixed(0)}%), ` +
          `retrying 180° (${flippedResult.confidence.toFixed(0)}%)`
        );
        activeBuffer = flipped;
        rawText = flippedResult.text;
      }
    }

    if (isTicketPage(rawText)) {
      return await tryExtractTicket(activeBuffer, rawText, pageNumber, docTypeCode);
    }

    if (isTransactionReceipt(rawText)) {
      return buildReceiptResult(rawText, pageNumber);
    }

    if (isSummaryPage(rawText)) {
      return buildSummaryResult(rawText, pageNumber, docTypeCode);
    }

    if (isCdrReport(rawText)) {
      return buildCdrReportResult(rawText, pageNumber);
    }

    return buildDetailResult(rawText, pageNumber, docTypeCode);
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
    fields: { orders } as PageFields,
    confidence,
    raw_text: rawText,
  };
}

function buildDetailResult(
  rawText: string,
  pageNumber: number,
  docTypeCode: string
): PageExtractionResult {
  const fields = parseFinsalesPage(rawText);
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

function buildReceiptResult(
  rawText: string,
  pageNumber: number
): PageExtractionResult {
  const fields = parseTransactionReceipt(rawText);
  const confidence = calculateReceiptConfidence(fields);

  logger.info(
    `Extracted RECEIPT page ${pageNumber}: confidence=${(confidence * 100).toFixed(0)}%, ` +
    `order=${fields.order_id}, customer=${fields.customer_name}`
  );

  return {
    page_number: pageNumber,
    document_type: 'RECEIPT',
    fields,
    confidence,
    raw_text: rawText,
  };
}

function buildSummaryResult(
  rawText: string,
  pageNumber: number,
  docTypeCode: string
): PageExtractionResult {
  const orders = parseSummaryText(rawText);
  const confidence = Math.min(orders.length / 5, 1);

  logger.info(
    `Extracted ${docTypeCode} manifest page ${pageNumber}: ${orders.length} orders`
  );

  return {
    page_number: pageNumber,
    document_type: docTypeCode,
    fields: { orders } as PageFields,
    confidence,
    raw_text: rawText,
  };
}

function buildCdrReportResult(
  rawText: string,
  pageNumber: number
): PageExtractionResult {
  const fields = parseCdrReport(rawText);
  const confidence = calculateCdrConfidence(fields);

  logger.info(
    `Extracted CDR_REPORT page ${pageNumber}: confidence=${(confidence * 100).toFixed(0)}%, ` +
    `drawers=[${fields.cash_drawers}], total=${fields.grand_total}, ` +
    `trans=${fields.trans_count}, orders=${fields.order_ids.length}`
  );

  return {
    page_number: pageNumber,
    document_type: 'CDR_REPORT',
    fields: fields as PageFields,
    confidence,
    raw_text: rawText,
  };
}

async function tryExtractTicket(
  pageBuffer: Buffer,
  rawText: string,
  pageNumber: number,
  docTypeCode: string
): Promise<PageExtractionResult> {
  const fields = parseTicketText(rawText);

  const barcode = await scanBarcodeInRegion(pageBuffer, 0.65, 0.35);
  if (barcode) {
    fields.order_id = barcode;
  }

  const confidence = calculateTicketConfidence(fields);

  logger.info(
    `Extracted ${fields.fulfillment} ticket ${docTypeCode} page ${pageNumber}: ` +
    `order=${fields.order_id}, customer=${fields.customer_name} (barcode=${barcode ?? 'none'})`
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
  const result = await ocrRecognize(imageBuffer);
  return result.data.text;
}

async function ocrPageWithConfidence(
  imageBuffer: Buffer
): Promise<{ text: string; confidence: number }> {
  const result = await ocrRecognize(imageBuffer);
  return { text: result.data.text, confidence: result.data.confidence };
}
