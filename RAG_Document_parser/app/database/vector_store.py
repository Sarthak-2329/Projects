import os
import chromadb
from typing import List, Dict, Any

# Define the persistent directory relative to the project root
CHROMA_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "chroma_db")

class VectorStore:
    def __init__(self, collection_name: str = "documents"):
        # Initialize the persistent client
        self.client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)
        # Get or create the collection
        self.collection = self.client.get_or_create_collection(name=collection_name)

    def add_chunks(self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[Dict[str, Any]]):
        """Adds a batch of chunks to the vector store."""
        if not ids:
            return
            
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """
        Retrieves all chunks to aggregate and list ingested documents with chunk counts.
        """
        # Note: Since Chroma doesn't have a distinct "documents" entity (only chunks),
        # we pull all metadata and group them to satisfy the GET /documents endpoint.
        # In a production app with millions of chunks, you'd store this in a relational DB.
        
        results = self.collection.get(include=["metadatas"])
        metadatas = results.get("metadatas", [])
        
        doc_stats = {}
        for meta in metadatas:
            if not meta:
                continue
                
            source = meta.get("source", "unknown")
            if source not in doc_stats:
                doc_stats[source] = {"document_id": source, "chunk_count": 0}
            doc_stats[source]["chunk_count"] += 1
            
        return list(doc_stats.values())
