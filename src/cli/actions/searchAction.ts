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

export const runSearchAction = async (
  searchQuery: string,
  options: CliOptions
): Promise<void> => {
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    logger.error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    return;
  }

  const directory = process.cwd();
  const metadataPath = path.join(directory, 'repomix-metadata.json');
  const vectorIndexPath = path.join(directory, 'repomix-vector.faiss');

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

  const listOfFiles = await fs.readdir(directory);

  for (const fileName of listOfFiles) {
    const filePath = path.join(directory, fileName);
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
