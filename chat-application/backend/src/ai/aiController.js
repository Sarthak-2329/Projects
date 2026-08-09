import { globalVectorStore } from "./vectorStore.js";
import { io } from "../lib/socket.js";

/**
 * Handle document text upload and index into VectorStore
 */
export const uploadDocument = async (req, res) => {
  try {
    const { documentName, textContent } = req.body;

    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ message: "Document text content is required." });
    }

    const docId = documentName || `doc_${Date.now()}`;
    await globalVectorStore.addDocument(docId, textContent, { uploadedAt: new Date() });

    res.status(200).json({
      success: true,
      message: `Document "${docId}" successfully processed and indexed into Vector Store.`,
      docId,
    });
  } catch (error) {
    console.error("Error uploading document to vector store:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
};

/**
 * Perform RAG Context Retrieval and stream response tokens via WebSockets / HTTP
 */
export const queryRAG = async (req, res) => {
  try {
    const { query, socketId } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Query string is required." });
    }

    // 1. Context Retrieval from Vector Store
    const relevantChunks = globalVectorStore.similaritySearch(query, 3);
    const contextText = relevantChunks.map(c => c.text).join("\n---\n");

    const prompt = `Context:\n${contextText}\n\nUser Question: ${query}\nAnswer based on context:`;

    // Simulated / Gemini stream output generator
    const sampleTokens = [
      "Based ", "on ", "the ", "uploaded ", "document ", "context:\n\n",
      contextText.length > 0 ? contextText.slice(0, 150) + "..." : "No specific document match found. ",
      "\n\nHere ", "is ", "the ", "synthesized ", "answer ", "to ", "your ", "query."
    ];

    if (socketId) {
      // Real-time WebSocket token streaming
      for (const token of sampleTokens) {
        io.to(socketId).emit("aiToken", { token });
        await new Promise(resolve => setTimeout(resolve, 50)); // simulate stream chunking
      }
      io.to(socketId).emit("aiDone", { fullPrompt: prompt });
      return res.status(200).json({ status: "streaming_completed" });
    }

    // Direct HTTP response fallback
    res.status(200).json({
      query,
      context: relevantChunks,
      answer: sampleTokens.join(""),
    });
  } catch (error) {
    console.error("Error in queryRAG:", error);
    res.status(500).json({ error: "AI Query processing failed" });
  }
};
