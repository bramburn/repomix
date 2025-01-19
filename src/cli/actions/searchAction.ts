import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { globby } from 'globby';
import ora from 'ora';
import { loadFileConfig, mergeConfigs } from '../../config/configLoad.js';
import type { CliOptions, RepomixConfigMerged } from '../../config/configSchema.js';
import type { CreateVectorFunction } from '../../core/file/fileProcess.js';
import { createVector } from '../../core/file/fileProcess.js';
import { logger } from '../../shared/logger.js';

const transformCliOptions = (options: CliOptions) => {
  return {
    ...options,
    output: options.output
      ? {
          filePath: options.output,
          style: options.style,
          showLineNumbers: options.outputShowLineNumbers,
          fileSummary: options.fileSummary,
          directoryStructure: options.directoryStructure,
          removeComments: options.removeComments,
          removeEmptyLines: options.removeEmptyLines,
          copyToClipboard: options.copy,
        }
      : undefined,
    include: options.include ? [options.include] : undefined,
    ignore: options.ignore
      ? {
          customPatterns: [options.ignore],
          useGitignore: true,
          useDefaultPatterns: true,
        }
      : undefined,
    security: options.securityCheck ? { enableSecurityCheck: options.securityCheck } : undefined,
  };
};

const loadAndParseOptions = async (
  directory: string,
  cwd: string,
  options: CliOptions,
): Promise<{
  config: RepomixConfigMerged;
}> => {
  try {
    const fileConfig = await loadFileConfig(cwd, options.config ?? null);
    const transformedOptions = transformCliOptions(options);
    const config = mergeConfigs(cwd, fileConfig, transformedOptions);
    return { config };
  } catch (error) {
    logger.error('Error loading and parsing options:', error);
    throw error;
  }
};

const filterFiles = async (targetPath: string, config: RepomixConfigMerged): Promise<string[]> => {
  try {
    const includePatterns = config.include?.map((pattern) => path.join(targetPath, pattern)) ?? [];
    const ignorePatterns = config.ignore?.customPatterns?.map((pattern) => path.join(targetPath, pattern)) ?? [];
    const files = await globby(includePatterns, { ignore: ignorePatterns });
    return files;
  } catch (error) {
    logger.error('Error filtering files:', error);
    throw error;
  }
};

const createVectorsForFiles = async (files: string[], createVector: CreateVectorFunction): Promise<void> => {
  try {
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      await createVector(content, file);
    }
  } catch (error) {
    logger.error('Error creating vectors:', error);
    throw error;
  }
};

export const searchAction = async (
  directory: string,
  cwd: string,
  options: CliOptions,
  deps = {
    loadFileConfig: loadFileConfig,
    mergeConfigs: mergeConfigs,
    fileGlob: globby,
    createVector: createVector,
    fileRead: fs.readFile,
    spinner: ora,
  },
): Promise<void> => {
  const spinner = deps.spinner('Loading configuration...');

  try {
    spinner.start();
    const { config } = await loadAndParseOptions(directory, cwd, options);
    spinner.succeed('Configuration loaded successfully!');

    const targetPath = path.resolve(directory);

    spinner.start('Filtering files...');
    const files = await filterFiles(targetPath, config);
    spinner.succeed(`Filtered ${files.length} files.`);

    spinner.start('Creating vectors...');
    await createVectorsForFiles(files, deps.createVector);
    spinner.succeed('Vectors created successfully!');

    // TODO: Implement final search functionality
    // This could involve querying the created vectors or preparing them for later search
  } catch (error) {
    spinner.fail('Error during search action');
    logger.error('Search action failed:', error);
    throw error;
  }
};
