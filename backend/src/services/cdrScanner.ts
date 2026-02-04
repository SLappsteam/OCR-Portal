import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import sharp from 'sharp';
import { extractPageAsPng } from './tiffService';
import { correctPageImage } from './imageCorrection';
import { ocrWithRotationRetry } from '../utils/ocrRetry';
import { isTicketPage, parseTicketText, calculateTicketConfidence } from './extraction/ticketParser';
import { parseFinsalesPage, calculateConfidence } from './extraction/finsalesParser';
import { isCdrReport, parseCdrReport, calculateCdrConfidence } from './extraction/cdrReportParser';
import {
  isTransactionReceipt,
  parseTransactionReceipt,
  calculateReceiptConfidence,
} from './extraction/transactionReceiptParser';
import { isDepositTicket } from './extraction/depositTicketParser';
import { scanBarcodeInRegion, getDocumentTypeByCode } from './barcodeService';
import { parseManifestOrders } from './manifestDetector';
import { logger } from '../utils/logger';

const FINSALES_HEADER = /TYPE\s*:.*STAT\s*[.:]/i;
const CREDIT_HEADER = /CREDIT\s*:\s*\d/i;
// Fallback: OCR may garble "ORDER TYPE:" but "STAT:" usually survives
const STAT_FALLBACK = /\bSTAT\s*[.:]\s*[A-Z]\b/i;
const FINTRAN_PATTERNS = [
  /FINANCE\s+COMPANY/i,
  /MONTHLY\s+PAYMENT/i,
  /FINANCED\s+AMOUNT/i,
  /FINANCING\s+AGREEMENT/i,
  /APR|ANNUAL\s+PERCENTAGE/i,
  /LOAN\s+AMOUNT/i,
];
const LOW_CONFIDENCE_THRESHOLD = 50;

function isFintranContent(text: string): boolean {
  return FINTRAN_PATTERNS.some((p) => p.test(text));
}

function isFinsalesContent(text: string): boolean {
  return FINSALES_HEADER.test(text) || isTicketPage(text) || CREDIT_HEADER.test(text) || STAT_FALLBACK.test(text);
}

function isInvoiceContent(text: string): boolean {
  return isFinsalesContent(text) || isFintranContent(text);
}

export async function classifyPageContent(
  docId: number,
  filePath: string,
  page: number
): Promise<void> {
  const parsed = await ocrAndParse(filePath, page);

  if (parsed) {
    await setDocumentType(docId, parsed.documentType);
    await storePageExtraction(docId, parsed, page);
  }
}

interface ParsedPage {
  fields: Record<string, unknown>;
  raw_text: string;
  confidence: number;
  documentType: string;
}

async function setDocumentType(
  docId: number,
  typeCode: string
): Promise<void> {
  const docType = await getDocumentTypeByCode(typeCode);
  if (docType) {
    await prisma.document.update({
      where: { id: docId },
      data: { document_type_id: docType.id },
    });
  }
}

async function ocrAndParse(
  filePath: string,
  page: number
): Promise<ParsedPage | null> {
  const png = await extractPageAsPng(filePath, page);
  const corrected = await correctPageImage(png);

  const ocrResult = await ocrWithRotationRetry(corrected, LOW_CONFIDENCE_THRESHOLD);

  const manifestResult = await tryParseManifest(
    corrected, ocrResult.text, ocrResult.confidence
  );
  if (manifestResult) return manifestResult;

  return classifyAndParseText(ocrResult.text, ocrResult.buffer);
}

async function tryParseManifest(
  corrected: Buffer,
  text: string,
  ocrConf: number
): Promise<ParsedPage | null> {
  if (ocrConf >= LOW_CONFIDENCE_THRESHOLD && !hasManifestHints(text)) {
    return null;
  }

  const rotated90 = await sharp(corrected).rotate(270).png().toBuffer();
  const rotatedResult = await ocrWithRotationRetry(rotated90, 0);

  if (rotatedResult.confidence <= ocrConf) {
    return null;
  }

  const manifestOrders = parseManifestOrders(rotatedResult.text);
  if (manifestOrders.length < 2) {
    return null;
  }

  logger.info(`  Manifest detection: 90° CCW rotation improved OCR`);
  return {
    fields: { orders: manifestOrders, order_count: manifestOrders.length },
    raw_text: rotatedResult.text,
    confidence: rotatedResult.confidence / 100,
    documentType: 'MANIFEST',
  };
}

async function classifyAndParseText(
  text: string,
  activeBuffer: Buffer
): Promise<ParsedPage> {
  if (isCdrReport(text)) {
    const cdrFields = parseCdrReport(text);
    return {
      fields: cdrFields,
      raw_text: text,
      confidence: calculateCdrConfidence(cdrFields),
      documentType: 'CDR_REPORT',
    };
  }

  if (isTransactionReceipt(text)) {
    const receiptFields = parseTransactionReceipt(text);
    return {
      fields: receiptFields,
      raw_text: text,
      confidence: calculateReceiptConfidence(receiptFields),
      documentType: 'RECEIPT',
    };
  }

  if (isDepositTicket(text)) {
    return { fields: {}, raw_text: text, confidence: 1, documentType: 'DEPOSIT_TICKET' };
  }

  if (!isInvoiceContent(text)) {
    return { fields: {}, raw_text: text, confidence: 0, documentType: 'UNKNOWN' };
  }

  if (isTicketPage(text)) {
    return await parseTicketPage(text, activeBuffer);
  }

  const fields = parseFinsalesPage(text);
  return {
    fields,
    raw_text: text,
    confidence: calculateConfidence(fields),
    documentType: 'INVOICE',
  };
}

async function parseTicketPage(
  text: string,
  activeBuffer: Buffer
): Promise<ParsedPage> {
  const fields = parseTicketText(text);
  const barcode = await scanBarcodeInRegion(activeBuffer, 0.65, 0.35);
  if (barcode) fields.order_id = barcode;
  return {
    fields,
    raw_text: text,
    confidence: calculateTicketConfidence(fields),
    documentType: 'INVOICE',
  };
}

function hasManifestHints(text: string): boolean {
  const orderPattern = /\b\d{7,}[A-Z]{1,2}\b/g;
  const matches = text.match(orderPattern);
  return (matches?.length ?? 0) >= 2;
}

async function storePageExtraction(
  docId: number,
  result: ParsedPage,
  page: number
): Promise<void> {
  const existing = await prisma.pageExtraction.findFirst({
    where: { document_id: docId, page_number: page },
  });

  const data = {
    document_id: docId,
    page_number: page,
    fields: {
      document_type: result.documentType,
      ...result.fields,
    } as Prisma.JsonObject,
    raw_text: result.raw_text,
    confidence: result.confidence,
  };

  if (existing) {
    await prisma.pageExtraction.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.pageExtraction.create({ data });
  }
}
