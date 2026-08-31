from app.services.extraction import extract_text_from_pdf
from app.services.chunking import chunk_text
from app.services.embedding import generate_embeddings
from app.database.vector_store import VectorStore

# Initialize the vector store once
vector_store = VectorStore()

def ingest_pdf(file_bytes: bytes, filename: str) -> dict:
    """
    Orchestrates the ingestion pipeline: Extract -> Chunk -> Embed -> Store.
    """
    # 1. Extract
    pages = extract_text_from_pdf(file_bytes, filename)
    if not pages:
        return {"document_id": filename, "chunks_created": 0}
        
    # 2. Chunk
    chunks = chunk_text(pages, chunk_size=500, overlap=50)
    
    # 3. Embed
    texts = [chunk["text"] for chunk in chunks]
    embeddings = generate_embeddings(texts)
    
    # 4. Store
    ids = [chunk["chunk_id"] for chunk in chunks]
    metadatas = [chunk["metadata"] for chunk in chunks]
    
    vector_store.add_chunks(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas
    )
    
    return {
        "document_id": filename,
        "chunks_created": len(chunks)
    }
