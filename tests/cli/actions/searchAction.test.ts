import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
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
    process.env.OPENAI_API_KEY = 'test-api-key-with-sufficient-length';

    // Mock file system methods
    vi.mocked(fs.readdir).mockResolvedValue(['file1.txt', 'file2.txt'] as any);
    vi.mocked(fs.stat).mockResolvedValue({ 
      isFile: () => true, 
      mtimeMs: Date.now() 
    } as any);
    vi.mocked(fs.readFile).mockResolvedValue('Sample file content');
    
    // Mock access method for vector store path validation
    vi.mocked(fs.access).mockResolvedValue(undefined);

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
  });

  afterEach(() => {
    // Clear environment
    delete process.env.OPENAI_API_KEY;
  });

  it('should perform vector search with valid OpenAI API key', async () => {
    const mockOptions = { 
      search: 'test query',
      openaiApiKey: 'test-api-key-with-sufficient-length'
    };

    await runSearchAction('test query', mockOptions);

    // Verify key interactions
    expect(FaissStore.load).toHaveBeenCalled();
    expect(FaissStore.fromTexts).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });

  it('should throw error for short or invalid OpenAI API key', async () => {
    const mockOptions = { 
      search: 'test query',
      openaiApiKey: 'short' 
    };

    await runSearchAction('test query', mockOptions);

    // Verify error logging for invalid API key
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid OpenAI API key')
    );
  });

  it('should validate vector store path', async () => {
    const mockOptions = { 
      search: 'test query',
      vectorStorePath: testVectorPath
    };

    // Mock access to fail for vector store path
    vi.mocked(fs.access).mockRejectedValue(new Error('Path not writable'));

    await runSearchAction('test query', mockOptions);

    // Verify error logging for invalid vector store path
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid vector store path')
    );
  });

  it('should handle force vector update', async () => {
    const mockOptions = { 
      search: 'test query', 
      forceUpdateVector: true,
      openaiApiKey: 'test-api-key-with-sufficient-length'
    };

    await runSearchAction('test query', mockOptions);

    // Verify force update behavior
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Forcing vector update'));
  });

  it('should throw error if no OpenAI API key is provided', async () => {
    delete process.env.OPENAI_API_KEY;

    const mockOptions = { search: 'test query' };

    await runSearchAction('test query', mockOptions);

    // Verify error logging
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('OpenAI API key is required')
    );
  });

  it('should perform similarity search and log results', async () => {
    const mockOptions = { 
      search: 'test query',
      openaiApiKey: 'test-api-key-with-sufficient-length'
    };

    // Adjust mock to return a method that can be called
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

    await runSearchAction('test query', mockOptions);

    // Verify search and logging
    const mockVectorStore = await FaissStore.fromTexts([], [], {} as any);
    expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('test query', 5);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Vector Search Results'));
  });
});
