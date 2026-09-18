import os
import chromadb
from typing import List, Dict, Any, Optional

# Define the persistent directory relative to the project root
CHROMA_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "chroma_db")

class VectorStore:
    def __init__(self, collection_name: str = "documents"):
        # Initialize the persistent client
        self.client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)
        self.collection_name = collection_name
        self._collection = None

    @property
    def collection(self):
        # Return assigned collection if set, otherwise get or create dynamically
        if self._collection is not None:
            return self._collection
        return self.client.get_or_create_collection(name=self.collection_name)

    @collection.setter
    def collection(self, value):
        self._collection = value

    def add_chunks(self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[Dict[str, Any]]):
        """
        Adds a batch of chunks to the vector store.

        Uses upsert() so that re-ingesting the same PDF is idempotent:
        existing chunk IDs are overwritten in-place rather than duplicated or
        raising an error.  Chunk IDs are deterministic ({source}_pN_cN), so
        the same document always produces the same IDs.
        """
        if not ids:
            return

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

    def count_chunks_for_document(self, document_id: str) -> int:
        """Returns the number of chunks stored for a specific document."""
        results = self.collection.get(
            where={"source": document_id},
            include=[]
        )
        return len(results.get("ids", []))

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

    def query_chunks(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Queries ChromaDB for the most similar chunks to the given embedding.

        Args:
            query_embedding: The embedding vector for the user's question.
            top_k: Number of top results to return (default 5).
            document_id: Optional filename to scope the search to a single document.

        Returns:
            A list of dicts, each containing:
              - chunk_id: The unique ID of the chunk in ChromaDB.
              - text: The chunk's text content.
              - metadata: The stored metadata (source, page, chunk_index).
              - distance: The similarity distance (lower = more similar).
        """
        # If the collection is empty, return early to avoid ChromaDB errors.
        if self.collection.count() == 0:
            return []

        # Cap top_k to the actual number of stored chunks so ChromaDB
        # doesn't complain about requesting more results than exist.
        actual_count = self.collection.count()
        effective_k = min(top_k, actual_count)

        # Build an optional where-filter to scope results to a single document.
        where_filter = {"source": document_id} if document_id else None

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=effective_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        # ChromaDB returns lists-of-lists (one inner list per query embedding).
        # We only ever send one query embedding, so we unpack index 0.
        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        chunks = []
        for i in range(len(ids)):
            chunks.append({
                "chunk_id": ids[i],
                "text": documents[i],
                "metadata": metadatas[i],
                "distance": distances[i]
            })

        return chunks

