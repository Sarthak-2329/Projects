/**
 * In-Memory Vector Store for RAG Document Retrieval
 * Computes embeddings and performs Cosine Similarity top-k nearest neighbor matching.
 */

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple deterministic TF-IDF / character-frequency embedding fallback generator if external API key is omitted
function generateFallbackEmbedding(text, dim = 64) {
  const embedding = new Array(dim).fill(0);
  const normalizedText = text.toLowerCase();
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const index = charCode % dim;
    embedding[index] += 1.0;
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

export class VectorStore {
  constructor() {
    this.documents = []; // Array of { id, text, metadata, embedding }
  }

  /**
   * Split document text into chunks
   */
  chunkText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Add text document to vector store
   */
  async addDocument(docId, text, metadata = {}) {
    const chunks = this.chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = generateFallbackEmbedding(chunkText);
      this.documents.push({
        id: `${docId}_chunk_${i}`,
        docId,
        text: chunkText,
        metadata: { ...metadata, chunkIndex: i },
        embedding,
      });
    }
    console.log(`[VectorStore]: Indexed ${chunks.length} chunks for document ${docId}`);
  }

  /**
   * Perform Cosine Similarity Search
   */
  similaritySearch(query, topK = 3) {
    const queryEmbedding = generateFallbackEmbedding(query);
    const results = this.documents.map(doc => {
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      return { ...doc, score };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  clear() {
    this.documents = [];
  }
}

export const globalVectorStore = new VectorStore();
