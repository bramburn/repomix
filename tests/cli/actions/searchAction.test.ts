import * as fs from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import { describe, expect, it, vi } from 'vitest';
import { searchAction } from '../../../src/cli/actions/searchAction.js';
import { loadFileConfig, mergeConfigs } from '../../../src/config/configLoad.js';
import { createVector } from '../../../src/core/file/fileProcess.js';

// Mock dependencies
vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
    })),
  };
});

vi.mock('globby', async () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../src/config/configLoad.js', () => ({
  loadFileConfig: vi.fn(),
  mergeConfigs: vi.fn(),
}));

vi.mock('../../../src/core/file/fileProcess.js', () => ({
  createVector: vi.fn(),
}));

// Mock path module
vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolve: vi.fn((p) => p),
    join: vi.fn((...args) => args.join('/')),
    default: {
      resolve: vi.fn((p) => p),
      join: vi.fn((...args) => args.join('/')),
    },
  };
});

// Mock fs module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('Search Action', () => {
  // Define mockConfig and mockOptions at the top level of the describe block
  const mockConfig = {
    include: ['src/*'],
    ignore: {
      useGitignore: true,
      useDefaultPatterns: true,
      customPatterns: ['tests/*'],
    },
    output: {
      filePath: 'repomix-output.txt',
      style: 'plain',
      fileSummary: true,
      directoryStructure: true,
    },
  };

  const mockOptions = {
    config: 'path/to/config',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load configuration and filter files', async () => {
    const mockFiles = ['/path/to/project/src/file1.ts', '/path/to/project/src/file2.ts'];

    // Import globby
    const globby = await import('globby');

    // Mock the dependencies
    (loadFileConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mergeConfigs as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);
    (globby.default as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    (path.resolve as ReturnType<typeof vi.fn>).mockReturnValue('/path/to/project');
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

    const mockDeps = {
      loadFileConfig,
      mergeConfigs,
      fileGlob: globby.default,
      createVector,
      fileRead: fs.readFile,
      spinner: ora,
    };

    await searchAction('/path/to/project', '/path/to/cwd', mockOptions, mockDeps);

    expect(loadFileConfig).toHaveBeenCalledWith('/path/to/cwd', mockOptions.config);
    expect(mergeConfigs).toHaveBeenCalledWith('/path/to/cwd', {}, mockOptions);
    expect(globby.default).toHaveBeenCalledWith(['/path/to/project/src/*'], { ignore: ['/path/to/project/tests/*'] });
    expect(createVector).toHaveBeenCalledTimes(mockFiles.length);
  });

  it('should handle errors during search action', async () => {
    const mockError = new Error('Search action failed');

    // Import globby
    const globby = await import('globby');

    // Mock the dependencies to simulate an error
    (loadFileConfig as ReturnType<typeof vi.fn>).mockRejectedValue(mockError);
    (mergeConfigs as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);

    const mockDeps = {
      loadFileConfig,
      mergeConfigs,
      fileGlob: globby.default,
      createVector,
      fileRead: fs.readFile,
      spinner: ora,
    };

    // Suppress console error to keep test output clean
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(searchAction('/path/to/project', '/path/to/cwd', mockOptions, mockDeps)).rejects.toThrow(
      'Search action failed',
    );

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
