import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadFileMetadata, saveFileMetadata } from '../../../src/core/metadata/metadataManager';

describe('Metadata Manager', () => {
  const testTempDir = path.join(process.cwd(), 'tests', 'temp');
  const testMetadataPath = path.join(testTempDir, 'test-metadata.json');

  beforeEach(async () => {
    // Ensure test temp directory exists
    await fs.mkdir(testTempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testMetadataPath, { force: true });
      await fs.rmdir(testTempDir);
    } catch {}
  });

  it('should save and load file metadata correctly', async () => {
    const testMetadata = {
      '/path/to/file1.txt': { hash: 'abc123', timestamp: 1234567890 },
      '/path/to/file2.txt': { hash: 'def456', timestamp: 9876543210 }
    };

    // Save metadata
    await saveFileMetadata(testMetadataPath, testMetadata);

    // Load metadata
    const loadedMetadata = await loadFileMetadata(testMetadataPath);

    // Verify loaded metadata matches saved metadata
    expect(loadedMetadata).toEqual(testMetadata);
  });

  it('should return empty object when metadata file does not exist', async () => {
    const nonExistentPath = path.join(testTempDir, 'non-existent-metadata.json');
    
    const metadata = await loadFileMetadata(nonExistentPath);
    
    expect(metadata).toEqual({});
  });

  it('should handle saving empty metadata', async () => {
    const emptyMetadata = {};

    await saveFileMetadata(testMetadataPath, emptyMetadata);

    const loadedMetadata = await loadFileMetadata(testMetadataPath);
    
    expect(loadedMetadata).toEqual({});
  });

  it('should create parent directories when saving metadata', async () => {
    const deepPath = path.join(testTempDir, 'nested', 'directory', 'metadata.json');
    const testMetadata = {
      '/path/to/file.txt': { hash: 'abc123', timestamp: 1234567890 }
    };

    await saveFileMetadata(deepPath, testMetadata);

    const loadedMetadata = await loadFileMetadata(deepPath);
    
    expect(loadedMetadata).toEqual(testMetadata);
  });
});
