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
  return detectBarcode(rotated);
}

async function validateDocumentType(code: string): Promise<string | null> {
  const isValid = await isValidDocumentType(code);
  if (!isValid) {
    logger.debug(`Ignoring unknown barcode code: ${code}`);
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
        }

        currentDocument = {
          documentTypeCode: validatedCode,
          startPage: page,
          endPage: page,
          barcodeRaw: rawBarcode,
        };

        logger.debug(`Page ${page}: Found barcode ${normalizedCode}`);
      }
    } else if (page === 0 && !currentDocument) {
      currentDocument = {
        documentTypeCode: UNCLASSIFIED_CODE,
        startPage: 0,
        endPage: 0,
        barcodeRaw: '',
      };
      logger.debug('Page 0: No barcode, starting UNCLASSIFIED document');
    }
  }

  const finalDoc = finalizeDocument(currentDocument, pageCount - 1);
  if (finalDoc) {
    boundaries.push(finalDoc);
  }

  logger.info(`Found ${boundaries.length} documents in TIFF`);
  return boundaries;
}
