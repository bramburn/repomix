import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { runSearchAction } from '../../../src/cli/actions/searchAction';
import { logger } from '../../../src/shared/logger';

// Mock dependencies
vi.mock('@langchain/community/vectorstores/faiss');
vi.mock('@langchain/openai');
vi.mock('node:fs/promises');
vi.mock('../../../src/shared/logger');

describe('Search Action', () => {
  const testTempDir = path.join(process.cwd(), 'tests', 'temp');
  const testVectorPath = path.join(testTempDir, 'test-vector.faiss');
  const testMetadataPath = path.join(testTempDir, 'test-metadata.json');

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Mock OpenAI API key
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Mock FaissStore methods
    vi.mocked(FaissStore.load).mockRejectedValue(new Error('No existing store'));
    vi.mocked(FaissStore.fromTexts).mockResolvedValue({
      addDocuments: vi.fn(),
      delete: vi.fn(),
      save: vi.fn(),
      similaritySearch: vi.fn().mockResolvedValue([
        { 
          pageContent: 'Test file content', 
          metadata: { source: '/test/file1.txt' } 
        }
      ])
    });

    // Mock file system methods
    vi.mocked(fs.readdir).mockResolvedValue(['file1.txt', 'file2.txt'] as any);
    vi.mocked(fs.stat).mockResolvedValue({ 
      isFile: () => true, 
      mtimeMs: Date.now() 
    } as any);
    vi.mocked(fs.readFile).mockResolvedValue('Sample file content');
  });

  afterEach(() => {
    // Clear environment
    delete process.env.OPENAI_API_KEY;
  });

  it('should perform vector search without errors', async () => {
    const mockOptions = { search: 'test query' };

    await runSearchAction('test query', mockOptions);

    // Verify key interactions
    expect(FaissStore.load).toHaveBeenCalled();
    expect(FaissStore.fromTexts).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });

  it('should handle force vector update', async () => {
    const mockOptions = { 
      search: 'test query', 
      forceUpdateVector: true 
    };

    await runSearchAction('test query', mockOptions);

    // Verify force update behavior
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Forcing vector update'));
  });

  it('should throw error if OpenAI API key is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    const mockOptions = { search: 'test query' };

    await runSearchAction('test query', mockOptions);

    // Verify error logging
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('OpenAI API key is required')
    );
  });

  it('should perform similarity search and log results', async () => {
    const mockOptions = { search: 'test query' };

    await runSearchAction('test query', mockOptions);

    // Verify search and logging
    expect(FaissStore.prototype.similaritySearch).toHaveBeenCalledWith('test query', 5);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Vector Search Results'));
  });
});
