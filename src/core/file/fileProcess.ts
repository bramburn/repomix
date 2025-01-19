import { setTimeout } from 'node:timers/promises';
import pMap from 'p-map';
import pc from 'picocolors';
import type { RepomixConfigMerged } from '../../config/configSchema.js';
import { logger } from '../../shared/logger.js';
import { getProcessConcurrency } from '../../shared/processConcurrency.js';
import type { RepomixProgressCallback } from '../../shared/types.js';
import { getFileManipulator } from './fileManipulate.js';
import type { ProcessedFile, RawFile } from './fileTypes.js';

export type CreateVectorFunction = (content: string, filePath: string) => Promise<void>;

export const createVector: CreateVectorFunction = async (content: string, filePath: string): Promise<void> => {
  try {
    logger.debug(`Creating vector for file: ${filePath}`);
    // TODO: Implement vector creation logic
    await Promise.resolve();
  } catch (error) {
    logger.error(`Error creating vector for file ${filePath}:`, error);
    throw error;
  }
};

export const processFiles = async (
  rawFiles: RawFile[],
  config: RepomixConfigMerged,
  progressCallback: RepomixProgressCallback,
): Promise<ProcessedFile[]> => {
  return pMap(
    rawFiles,
    async (rawFile, index) => {
      progressCallback(`Processing file... (${index + 1}/${rawFiles.length}) ${pc.dim(rawFile.path)}`);

      const resultContent = await processContent(rawFile.content, rawFile.path, config);

      // Sleep for a short time to prevent blocking the event loop
      await setTimeout(1);

      return {
        path: rawFile.path,
        content: resultContent,
      };
    },
    {
      concurrency: getProcessConcurrency(),
    },
  );
};

export const processContent = async (
  content: string,
  filePath: string,
  config: RepomixConfigMerged,
): Promise<string> => {
  let processedContent = content;
  const manipulator = getFileManipulator(filePath);

  logger.trace(`Processing file: ${filePath}`);

  const processStartAt = process.hrtime.bigint();

  if (config.output.removeComments && manipulator) {
    processedContent = manipulator.removeComments(processedContent);
  }

  if (config.output.removeEmptyLines && manipulator) {
    processedContent = manipulator.removeEmptyLines(processedContent);
  }

  processedContent = processedContent.trim();

  if (config.output.showLineNumbers) {
    const lines = processedContent.split('\n');
    const padding = lines.length.toString().length;
    const numberedLines = lines.map((line, index) => `${(index + 1).toString().padStart(padding)}: ${line}`);
    processedContent = numberedLines.join('\n');
  }

  const processEndAt = process.hrtime.bigint();

  logger.trace(`Processed file: ${filePath}. Took: ${(Number(processEndAt - processStartAt) / 1e6).toFixed(2)}ms`);

  return processedContent;
};
