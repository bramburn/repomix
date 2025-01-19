import { readFileSync } from 'node:fs';
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadFileMetadata, saveFileMetadata } from '../../core/metadata/metadataManager.js';
import type { CliOptions } from '../cliRun.js';
import { logger } from '../../shared/logger.js';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

interface FileMetadata {
  [filePath: string]: { hash: string, timestamp: number };
}

function getFileHash(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function updateVectorDB(
  filePath: string, 
  vectorStore: FaissStore, 
  embeddings: OpenAIEmbeddings, 
  fileMetadata: FileMetadata,
  forceUpdate: boolean = false
): Promise<void> {
  try {
    const fileStats = await fs.stat(filePath);
    const currentHash = getFileHash(filePath);
    const currentTimestamp = fileStats.mtimeMs;

    if ((filePath in fileMetadata && fileMetadata[filePath].hash !== currentHash) || forceUpdate) {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Remove old vector if it exists
      if (filePath in fileMetadata) {
        await vectorStore.delete({ ids: [filePath] });
      }
      
      // Generate new embedding and add to vector store
      const newDocument = new Document({ pageContent: content, metadata: { source: filePath } });
      await vectorStore.addDocuments([newDocument]);
      
      // Update metadata
      fileMetadata[filePath] = { hash: currentHash, timestamp: currentTimestamp };
    }
  } catch (error) {
    logger.error(`Error processing file ${filePath}:`, error);
  }
}

// Validate the vector store path to ensure the directory is writable
// This prevents issues with saving or loading the vector store
async function validateVectorStorePath(vectorIndexPath: string): Promise<boolean> {
  try {
    // Check if the parent directory of the vector store is writable
    await access(path.dirname(vectorIndexPath), constants.W_OK);
    return true;
  } catch {
    // Return false if the directory is not writable
    return false;
  }
}

// Validate the OpenAI API key to ensure it meets basic requirements
// Prevents unnecessary API calls with invalid keys
function validateOpenAIApiKey(apiKey: string): boolean {
  // Basic validation:
  // 1. Check if the key is not empty
  // 2. Ensure the key has a reasonable minimum length (most API keys are longer)
  return apiKey && apiKey.trim().length > 20;
}

export const runSearchAction = async (
  searchQuery: string,
  options: CliOptions
): Promise<void> => {
  const openAIApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    logger.error('❌ OpenAI API key is required. Set OPENAI_API_KEY environment variable or use --openai-api-key argument.');
    return;
  }

  if (!validateOpenAIApiKey(openAIApiKey)) {
    logger.error('❌ Invalid OpenAI API key. Please provide a valid API key.');
    return;
  }

  const vectorIndexPath = options.vectorStorePath || path.join(process.cwd(), 'repomix-vector.faiss');
  
  // Validate vector store path
  if (options.vectorStorePath) {
    const isValidPath = await validateVectorStorePath(vectorIndexPath);
    if (!isValidPath) {
      logger.error(`❌ Invalid vector store path: ${vectorIndexPath}. Ensure the directory is writable.`);
      return;
    }
  }

  const metadataPath = path.join(process.cwd(), 'repomix-metadata.json');

  // Initialize OpenAI embeddings
  const embeddings = new OpenAIEmbeddings({ openAIApiKey });

  let vectorStore: FaissStore;
  let fileMetadata: FileMetadata;

  try {
    vectorStore = await FaissStore.load(vectorIndexPath, embeddings);
  } catch (error) {
    logger.log("Creating new vector store");
    vectorStore = await FaissStore.fromTexts([], [], embeddings);
  }

  fileMetadata = await loadFileMetadata(metadataPath);

  if (options.forceUpdateVector) {
    logger.log("Forcing vector update from scratch...");
    fileMetadata = {};
  }

  const listOfFiles = await fs.readdir(process.cwd());

  for (const fileName of listOfFiles) {
    const filePath = path.join(process.cwd(), fileName);
    const fileStat = await fs.stat(filePath);

    if (fileStat.isFile()) {
      await updateVectorDB(filePath, vectorStore, embeddings, fileMetadata, options.forceUpdateVector);
    }
  }

  // Save updated vector store
  await vectorStore.save(vectorIndexPath);

  // Save fileMetadata to persistent storage
  await saveFileMetadata(metadataPath, fileMetadata);

  // Perform search
  const results = await vectorStore.similaritySearch(searchQuery, 5);

  logger.log("\n🔍 Vector Search Results:");
  results.forEach((doc, index) => {
    logger.log(`\n${index + 1}. File: ${doc.metadata.source}`);
    logger.log(`   Snippet: ${doc.pageContent.slice(0, 200)}...`);
  });
};
