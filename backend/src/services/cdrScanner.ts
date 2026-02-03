import { PrismaClient, Prisma } from '@prisma/client';
import sharp from 'sharp';
import { extractPageAsPng } from './tiffService';
import { correctPageImage } from './imageCorrection';
import { ocrRecognize } from './ocrPool';
import { isTicketPage, parseTicketText, calculateTicketConfidence } from './extraction/ticketParser';
import { parseFinsalesPage, calculateConfidence } from './extraction/finsalesParser';
import { scanBarcodeInRegion } from './barcodeService';
import { getDocumentTypeByCode } from './barcodeService';
import { detectManifest, parseManifestOrders } from './manifestDetector';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const FINSALES_HEADER = /TYPE\s*:.*STAT\s*[.:]/i;
const CREDIT_HEADER = /CREDIT\s*:\s*\d/i;
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
  return FINSALES_HEADER.test(text) || isTicketPage(text) || CREDIT_HEADER.test(text);
}

function detectDocumentType(text: string): 'FINTRAN' | 'FINSALES' | null {
  // Check FINSALES first - it has more specific header patterns
  // FINSALES tickets may mention "FINANCED AMOUNT" but are still sales tickets
  if (isFinsalesContent(text)) return 'FINSALES';
  if (isFintranContent(text)) return 'FINTRAN';
  return null;
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
  fields: unknown;
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

  // Check for manifest page first (may need 90° rotation)
  const manifestResult = await detectManifest(corrected);
  if (manifestResult.isManifest) {
    const orders = parseManifestOrders(manifestResult.text);
    return {
      fields: {
        orders,
        order_count: orders.length,
      },
      raw_text: manifestResult.text,
      confidence: manifestResult.confidence / 100,
      documentType: 'MANIFEST',
    };
  }

  let { text, confidence: ocrConf } = await ocrWithConfidence(corrected);
  let activeBuffer = corrected;

  if (ocrConf < LOW_CONFIDENCE_THRESHOLD) {
    const flipped = await sharp(corrected).rotate(180).png().toBuffer();
    const flipped$ = await ocrWithConfidence(flipped);
    if (flipped$.confidence > ocrConf + 10) {
      text = flipped$.text;
      activeBuffer = flipped;
    }
  }

  const docType = detectDocumentType(text);
  if (!docType) return null;

  if (isTicketPage(text)) {
    const fields = parseTicketText(text);
    const barcode = await scanBarcodeInRegion(activeBuffer, 0.65, 0.35);
    if (barcode) fields.order_id = barcode;
    return {
      fields,
      raw_text: text,
      confidence: calculateTicketConfidence(fields),
      documentType: 'FINSALES',
    };
  }

  const fields = parseFinsalesPage(text);
  return {
    fields,
    raw_text: text,
    confidence: calculateConfidence(fields),
    documentType: docType,
  };
}

async function ocrWithConfidence(
  buf: Buffer
): Promise<{ text: string; confidence: number }> {
  const result = await ocrRecognize(buf);
  return { text: result.data.text, confidence: result.data.confidence };
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
      ...(result.fields as Record<string, unknown>),
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
