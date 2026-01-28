import sharp from 'sharp';
import { getTiffPageCount, extractPageAsPng } from './tiffService';
import {
  detectBarcode,
  normalizeBarcode,
  isValidDocumentType,
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
  const result = await detectBarcode(pageBuffer);
  if (result) return result;

  // Retry with 180° rotation for upside-down pages
  const rotated = await sharp(pageBuffer).rotate(180).png().toBuffer();
  const rotatedResult = await detectBarcode(rotated);
  if (rotatedResult) {
    logger.info(`  Page ${pageNumber}: barcode found after 180° retry`);
  }
  return rotatedResult;
}

async function validateDocumentType(code: string): Promise<string | null> {
  const isValid = await isValidDocumentType(code);
  if (!isValid) {
    logger.info(`  Ignoring unrecognized barcode code: "${code}"`);
    return null;
  }
  return code;
}

function finalizeDocument(
  current: DocumentBoundary | null,
  endPage: number
): DocumentBoundary | null {
  if (!current) return null;
  return { ...current, endPage };
}

export async function analyzeTiff(
  filePath: string
): Promise<DocumentBoundary[]> {
  const pageCount = await getTiffPageCount(filePath);

  if (pageCount === 0) {
    throw new Error('TIFF file has no pages');
  }

  logger.info(`Analyzing TIFF with ${pageCount} pages: ${filePath}`);

  const boundaries: DocumentBoundary[] = [];
  let currentDocument: DocumentBoundary | null = null;

  for (let page = 0; page < pageCount; page++) {
    const rawBarcode = await scanPageForBarcode(filePath, page);

    if (rawBarcode) {
      const normalizedCode = normalizeBarcode(rawBarcode);
      const validatedCode = await validateDocumentType(normalizedCode);

      if (validatedCode) {
        const finalized = finalizeDocument(currentDocument, page - 1);
        if (finalized) {
          boundaries.push(finalized);
          logger.info(`  Closed ${finalized.documentTypeCode} (pages ${finalized.startPage}-${finalized.endPage})`);
        }

        currentDocument = {
          documentTypeCode: validatedCode,
          startPage: page,
          endPage: page,
          barcodeRaw: rawBarcode,
        };

        logger.info(`  Page ${page}: coversheet detected -> ${validatedCode}`);
      } else {
        logger.info(`  Page ${page}: barcode read "${normalizedCode}" but not a valid doc type`);
      }
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

  const summary = boundaries
    .map((b) => `${b.documentTypeCode}[${b.startPage}-${b.endPage}]`)
    .join(', ');
  logger.info(`Split result: ${boundaries.length} documents -> ${summary}`);
  return boundaries;
}
