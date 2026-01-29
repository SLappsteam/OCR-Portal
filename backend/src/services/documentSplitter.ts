import { getTiffPageCount, extractPageAsPng } from './tiffService';
import {
  detectBarcode,
  normalizeBarcode,
} from './barcodeService';
import { logger } from '../utils/logger';

export interface DocumentBoundary {
  documentTypeCode: string;
  startPage: number;
  endPage: number;
  barcodeRaw: string;
}

const UNCLASSIFIED_CODE = 'UNCLASSIFIED';

async function scanPageForBarcode(
  filePath: string,
  pageNumber: number
): Promise<string | null> {
  const pageBuffer = await extractPageAsPng(filePath, pageNumber);
  return detectBarcode(pageBuffer);
}

function finalizeDocument(
  current: DocumentBoundary | null,
  endPage: number
): DocumentBoundary | null {
  if (!current) return null;
  return { ...current, endPage };
}

const PAGE_CONCURRENCY = 4;

async function scanAllPages(
  filePath: string,
  pageCount: number
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(pageCount).fill(null);

  for (let i = 0; i < pageCount; i += PAGE_CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, pageCount - i) },
      (_, j) => i + j
    );
    const batchResults = await Promise.all(
      batch.map((page) => scanPageForBarcode(filePath, page))
    );
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j]!;
    }
  }

  return results;
}

function buildBoundaries(
  pageResults: (string | null)[],
  pageCount: number
): DocumentBoundary[] {
  const boundaries: DocumentBoundary[] = [];
  let currentDocument: DocumentBoundary | null = null;

  for (let page = 0; page < pageCount; page++) {
    const rawBarcode = pageResults[page];

    if (rawBarcode) {
      const normalizedCode = normalizeBarcode(rawBarcode);
      // Validation is deferred to caller — store raw result
      currentDocument = handleBarcodePage(
        page, rawBarcode, normalizedCode, currentDocument, boundaries
      );
    } else if (page === 0 && !currentDocument) {
      currentDocument = {
        documentTypeCode: UNCLASSIFIED_CODE,
        startPage: 0,
        endPage: 0,
        barcodeRaw: '',
      };
      logger.info('  Page 0: no barcode found, starting as UNCLASSIFIED');
    } else {
      logger.info(`  Page ${page}: no barcode (continuation)`);
    }
  }

  const finalDoc = finalizeDocument(currentDocument, pageCount - 1);
  if (finalDoc) {
    boundaries.push(finalDoc);
    logger.info(`  Closed ${finalDoc.documentTypeCode} (pages ${finalDoc.startPage}-${finalDoc.endPage})`);
  }

  return boundaries;
}

function handleBarcodePage(
  page: number,
  rawBarcode: string,
  normalizedCode: string,
  currentDocument: DocumentBoundary | null,
  boundaries: DocumentBoundary[]
): DocumentBoundary | null {
  // Synchronous boundary check — validated codes are uppercase alpha
  const isKnown = validatedDocTypes.has(normalizedCode);
  if (!isKnown) {
    logger.info(`  Ignoring unrecognized barcode code: "${normalizedCode}"`);
    logger.info(`  Page ${page}: barcode read "${normalizedCode}" but not a valid doc type`);
    return currentDocument;
  }

  const finalized = finalizeDocument(currentDocument, page - 1);
  if (finalized) {
    boundaries.push(finalized);
    logger.info(`  Closed ${finalized.documentTypeCode} (pages ${finalized.startPage}-${finalized.endPage})`);
  }

  logger.info(`  Page ${page}: coversheet detected -> ${normalizedCode}`);
  return {
    documentTypeCode: normalizedCode,
    startPage: page,
    endPage: page,
    barcodeRaw: rawBarcode,
  };
}

let validatedDocTypes: Set<string> = new Set();

async function loadDocumentTypes(): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const types = await prisma.documentType.findMany({
      where: { is_active: true },
      select: { code: true },
    });
    validatedDocTypes = new Set(types.map((t) => t.code));
    logger.info(`Loaded ${validatedDocTypes.size} active document types`);
  } finally {
    await prisma.$disconnect();
  }
}

export async function analyzeTiff(
  filePath: string
): Promise<DocumentBoundary[]> {
  const pageCount = await getTiffPageCount(filePath);

  if (pageCount === 0) {
    throw new Error('TIFF file has no pages');
  }

  logger.info(`Analyzing TIFF with ${pageCount} pages: ${filePath}`);

  // Load valid doc types once, then scan all pages in parallel
  await loadDocumentTypes();
  const pageResults = await scanAllPages(filePath, pageCount);
  const boundaries = buildBoundaries(pageResults, pageCount);

  const summary = boundaries
    .map((b) => `${b.documentTypeCode}[${b.startPage}-${b.endPage}]`)
    .join(', ');
  logger.info(`Split result: ${boundaries.length} documents -> ${summary}`);
  return boundaries;
}
