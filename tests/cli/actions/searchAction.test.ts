import * as fs from 'node:fs/promises';
import path from 'node:path';
import { globby } from 'globby';
import ora from 'ora';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchAction } from '../../../src/cli/actions/searchAction.js';
import { loadFileConfig, mergeConfigs } from '../../../src/config/configLoad.js';
import { createVector } from '../../../src/core/file/fileProcess.js';

// Mock dependencies
vi.mock('globby', () => ({
  globby: vi.fn(),
}));

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

    // Mock the dependencies
    (loadFileConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mergeConfigs as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);
    (globby as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    (path.resolve as ReturnType<typeof vi.fn>).mockReturnValue('/path/to/project');
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

    const mockDeps = {
      loadFileConfig,
      mergeConfigs,
      fileGlob: globby,
      createVector,
      fileRead: fs.readFile,
      spinner: ora,
    };

    // Add debug logging
    console.log('Test: should load configuration and filter files');
    console.log('Input:', { directory: '/path/to/project', cwd: '/path/to/cwd', mockOptions });

    await searchAction('/path/to/project', '/path/to/cwd', mockOptions, mockDeps);

    console.log('Verifying expectations...');

    expect(loadFileConfig).toHaveBeenCalledWith('/path/to/cwd', mockOptions.config);
    expect(mergeConfigs).toHaveBeenCalledWith('/path/to/cwd', {}, mockOptions);
    expect(globby).toHaveBeenCalledWith(['/path/to/project/src/*'], {
      ignore: ['/path/to/project/tests/*'],
    });
    expect(createVector).toHaveBeenCalledTimes(mockFiles.length);

    console.log('Test completed successfully');
  });

  it('should handle errors during search action', async () => {
    const mockError = new Error('Search action failed');

    // Mock the dependencies to simulate an error
    (loadFileConfig as ReturnType<typeof vi.fn>).mockRejectedValue(mockError);
    (mergeConfigs as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);

    const mockDeps = {
      loadFileConfig,
      mergeConfigs,
      fileGlob: globby,
      createVector,
      fileRead: fs.readFile,
      spinner: ora,
    };

    // Add debug logging
    console.log('Test: should handle errors during search action');
    console.log('Expected error:', mockError.message);

    // Suppress console error to keep test output clean
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(searchAction('/path/to/project', '/path/to/cwd', mockOptions, mockDeps)).rejects.toThrow(
      'Search action failed',
    );

    console.log('Test completed successfully - error was caught as expected');

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
