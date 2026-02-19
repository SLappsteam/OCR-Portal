import sharp from 'sharp';
import { stat } from 'fs/promises';
import { logger } from '../utils/logger';

export interface TiffMetadata {
  width: number;
  height: number;
  pages: number;
  fileSize: number;
}

export async function getTiffPageCount(filePath: string): Promise<number> {
  try {
    const metadata = await sharp(filePath).metadata();
    return metadata.pages ?? 1;
  } catch (error) {
    logger.error(`Error getting page count for ${filePath}:`, error);
    throw new Error(`Failed to read TIFF file: ${filePath}`);
  }
}

export async function extractPageAsPng(
  filePath: string,
  pageNumber: number
): Promise<Buffer> {
  try {
    const totalPages = await getTiffPageCount(filePath);
    const pageIndex = pageNumber - 1;

    if (pageIndex < 0 || pageIndex >= totalPages) {
      throw new Error(
        `Page ${pageNumber} out of range (1-${totalPages})`
      );
    }

    return sharp(filePath, { page: pageIndex })
      .png()
      .toBuffer();
  } catch (error) {
    logger.error(
      `Error extracting page ${pageNumber} from ${filePath}:`,
      error
    );
    throw error;
  }
}

export async function getTiffMetadata(
  filePath: string
): Promise<TiffMetadata> {
  try {
    const [metadata, stats] = await Promise.all([
      sharp(filePath).metadata(),
      stat(filePath),
    ]);

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      pages: metadata.pages ?? 1,
      fileSize: stats.size,
    };
  } catch (error) {
    logger.error(`Error getting metadata for ${filePath}:`, error);
    throw new Error(`Failed to read TIFF metadata: ${filePath}`);
  }
}
