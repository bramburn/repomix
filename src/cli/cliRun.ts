import process from 'node:process';
import { type OptionValues, program } from 'commander';
import pc from 'picocolors';
import type { RepomixOutputStyle } from '../config/configSchema.js';
import { getVersion } from '../core/file/packageJsonParse.js';
import { handleError } from '../shared/errorHandle.js';
import { logger } from '../shared/logger.js';
import { runDefaultAction } from './actions/defaultAction.js';
import { runInitAction } from './actions/initAction.js';
import { runRemoteAction } from './actions/remoteAction.js';
import { searchAction } from './actions/searchAction.js';
import { runVersionAction } from './actions/versionAction.js';

export interface CliOptions extends OptionValues {
  version?: boolean;
  output?: string;
  include?: string;
  ignore?: string;
  config?: string;
  copy?: boolean;
  verbose?: boolean;
  topFilesLen?: number;
  outputShowLineNumbers?: boolean;
  style?: RepomixOutputStyle;
  init?: boolean;
  global?: boolean;
  remote?: string;
  remoteBranch?: string;
  securityCheck?: boolean;
  fileSummary?: boolean;
  directoryStructure?: boolean;
  removeComments?: boolean;
  removeEmptyLines?: boolean;
  tokenCountEncoding?: string;
  search?: string;
  forceUpdateVector?: boolean;
  vectorStorePath?: string;
  openaiApiKey?: string;
}

export const run = async () => {
  try {
    program
      .description('Repomix - Pack your repository into a single AI-friendly file')
      .arguments('[directory]')
      .option('-v, --version', 'show version information')
      .option('-o, --output <file>', 'specify the output file name')
      .option('--include <patterns>', 'list of include patterns (comma-separated)')
      .option('-i, --ignore <patterns>', 'additional ignore patterns (comma-separated)')
      .option('-c, --config <path>', 'path to a custom config file')
      .option('--copy', 'copy generated output to system clipboard')
      .option('--top-files-len <number>', 'specify the number of top files to display', Number.parseInt)
      .option('--output-show-line-numbers', 'add line numbers to each line in the output')
      .option('--style <type>', 'specify the output style (plain, xml, markdown)')
      .option('--no-file-summary', 'disable file summary section output')
      .option('--no-directory-structure', 'disable directory structure section output')
      .option('--remove-comments', 'remove comments')
      .option('--remove-empty-lines', 'remove empty lines')
      .option('--verbose', 'enable verbose logging for detailed output')
      .option('--init', 'initialize a new repomix.config.json file')
      .option('--global', 'use global configuration (only applicable with --init)')
      .option('--remote <url>', 'process a remote Git repository')
      .option('--token-count-encoding <encoding>', 'specify token count encoding (e.g., o200k_base, cl100k_base)')
      .option(
        '--remote-branch <name>',
        'specify the remote branch name, tag, or commit hash (defaults to repository default branch)',
      )
      .option('--no-security-check', 'disable security check')
      .option('--search <query>', 'perform vector search on the repository')
      .option('--force-update-vector', 'force update of the vector database from scratch')
      .option('--vector-store-path <path>', 'specify the path to the FAISS vector store')
      .option('--openai-api-key <key>', 'specify the OpenAI API key')
      .action((directory = '.', options: CliOptions = {}) => executeAction(directory, process.cwd(), options));

    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
};

export const executeAction = async (directory: string, cwd: string, options: CliOptions) => {
  logger.setVerbose(options.verbose || false);

  if (options.version) {
    await runVersionAction();
    return;
  }

  const version = await getVersion();
  logger.log(pc.dim(`\n📦 Repomix v${version}\n`));

  if (options.init) {
    await runInitAction(cwd, options.global || false);
    return;
  }

  if (options.remote) {
    await runRemoteAction(options.remote, options);
    return;
  }

  if (options.search) {
    await searchAction(options.search, process.cwd(), options);
    return;
  }

  await runDefaultAction(directory, cwd, options);
};
