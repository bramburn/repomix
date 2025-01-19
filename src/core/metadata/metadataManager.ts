import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../../shared/logger.js';

export async function loadFileMetadata(
  metadataPath: string,
): Promise<{ [filePath: string]: { hash: string; timestamp: number } }> {
  try {
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    try {
      return JSON.parse(metadataContent) as { [filePath: string]: { hash: string; timestamp: number } };
    } catch (parseError) {
      // Log the parsing error but return an empty object
      logger.warn(`Invalid JSON in metadata file ${metadataPath}: ${parseError}`);
      return {};
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    logger.error('Error loading metadata:', error);
    return {}; // Return empty object for any other unexpected errors
  }
}

export async function saveFileMetadata(
  metadataPath: string,
  fileMetadata: { [filePath: string]: { hash: string; timestamp: number } },
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(fileMetadata, null, 2));
  } catch (error) {
    logger.error('Error saving metadata:', error);
    throw error;
  }
}
