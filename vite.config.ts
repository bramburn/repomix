import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['node:fs', 'node:path', 'node:url', 'process'],
      globals: {
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@langchain/community/vectorstores': '@langchain/community/vectorstores/index.js',
      '@langchain/community/vectorstores/faiss': '@langchain/community/vectorstores/faiss.js',
      '@langchain/openai': '@langchain/openai/index.js',
      '@langchain/core/documents': '@langchain/core/documents.js',
    },
  },
  optimizeDeps: {
    include: ['@langchain/community', '@langchain/core', '@langchain/openai', 'langchain', 'ora'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  esbuild: {
    target: 'esnext',
  },
});
