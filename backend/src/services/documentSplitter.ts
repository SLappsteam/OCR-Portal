import { getTiffPageCount, extractPageAsPng } from './tiffService';
import { detectBarcode, normalizeBarcode } from './barcodeService';
import { logger } from '../utils/logger';

export interface BatchSection {
  documentTypeCode: string;
  pages: number[];
  barcodeRaw: string;
}

const UNCLASSIFIED_CODE = 'UNCLASSIFIED';
const PAGE_CONCURRENCY = 4;

async function scanPageForBarcode(
  filePath: string,
  pageNumber: number
): Promise<string | null> {
  const pageBuffer = await extractPageAsPng(filePath, pageNumber);
  return detectBarcode(pageBuffer);
}

async function scanAllPages(
  filePath: string,
  pageCount: number
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(pageCount).fill(null);

  for (let i = 0; i < pageCount; i += PAGE_CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, pageCount - i) },
      (_, j) => i + j + 1
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

interface ActiveSection {
  documentTypeCode: string;
  pages: number[];
  barcodeRaw: string;
}

function handleBarcodePage(
  page: number,
  rawBarcode: string,
  normalizedCode: string,
  current: ActiveSection | null,
  sections: BatchSection[]
): ActiveSection | null {
  const isKnown = validBatchTypes.has(normalizedCode);
  if (!isKnown) {
    logger.info(`  Page ${page}: barcode "${normalizedCode}" not recognized, treating as continuation`);
    // Still add page to current section - don't skip pages
    if (current) {
      current.pages.push(page);
    }
    return current;
  }

  if (current) {
    sections.push({ ...current });
    const range = current.pages;
    logger.info(
      `  Closed ${current.documentTypeCode} (pages ${range[0]}-${range[range.length - 1]})`
    );
  }

  logger.info(`  Page ${page}: coversheet detected -> ${normalizedCode}`);
  return {
    documentTypeCode: normalizedCode,
    pages: [page],
    barcodeRaw: rawBarcode,
  };
}

function buildBatchSections(
  pageResults: (string | null)[],
  pageCount: number
): BatchSection[] {
  const sections: BatchSection[] = [];
  let current: ActiveSection | null = null;

  for (let page = 0; page < pageCount; page++) {
    const rawBarcode = pageResults[page];
    const pageNum = page + 1;

    if (rawBarcode) {
      const normalizedCode = normalizeBarcode(rawBarcode);
      current = handleBarcodePage(
        pageNum, rawBarcode, normalizedCode, current, sections
      );
    } else if (page === 0 && !current) {
      current = {
        documentTypeCode: UNCLASSIFIED_CODE,
        pages: [1],
        barcodeRaw: '',
      };
      logger.info('  Page 1: no barcode, starting as UNCLASSIFIED');
    } else if (current) {
      current.pages.push(pageNum);
      logger.info(`  Page ${pageNum}: no barcode (continuation)`);
    } else {
      logger.info(`  Page ${pageNum}: no barcode (continuation)`);
    }
  }

  if (current) {
    sections.push({ ...current });
    const range = current.pages;
    logger.info(
      `  Closed ${current.documentTypeCode} (pages ${range[0]}-${range[range.length - 1]})`
    );
  }

  return sections;
}

// Valid batch type codes that can appear on coversheet barcodes
// These are batch types, not document types (which are INVOICE, MANIFEST, UNKNOWN)
const VALID_BATCH_TYPES = new Set([
  'CDR',
  'APINV',
  'ATOMRCV',
  'MTOZRCV',
  'LBRCV',
  'REFUND',
  'EXPENSE',
  'FINSALES',
  'FINTRAN',
  'LOFTFIN',
  'WFDEP',
]);

let validBatchTypes: Set<string> = VALID_BATCH_TYPES;

export interface AnalyzeResult {
  sections: BatchSection[];
  totalPageCount: number;
}

export async function analyzeTiff(
  filePath: string
): Promise<AnalyzeResult> {
  const pageCount = await getTiffPageCount(filePath);

  if (pageCount === 0) {
    throw new Error('TIFF file has no pages');
  }

  logger.info(`Analyzing TIFF with ${pageCount} pages: ${filePath}`);

  const pageResults = await scanAllPages(filePath, pageCount);
  const sections = buildBatchSections(pageResults, pageCount);

  const summary = sections
    .map((s) => `${s.documentTypeCode}[${s.pages[0]}-${s.pages[s.pages.length - 1]}]`)
    .join(', ');
  logger.info(`Split result: ${sections.length} sections -> ${summary}`);
  return { sections, totalPageCount: pageCount };
}
