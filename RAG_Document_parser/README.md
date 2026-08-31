# Full-Stack RAG Document Parser - Week 1: Ingestion Pipeline

This is a portfolio project demonstrating the backend ingestion pipeline for a Retrieval-Augmented Generation (RAG) application. It handles parsing a PDF, chunking its text, embedding the chunks locally, and storing them in a ChromaDB vector store.

## Tech Stack
- **Framework**: FastAPI (Python 3.11+)
- **Extraction**: `pdfplumber`
- **Chunking**: Custom fixed-size overlapping window function
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`)
- **Vector DB**: ChromaDB (Local Persistent Client)

## Setup and Running Locally

### 1. Create a Virtual Environment and Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the FastAPI Server
```bash
uvicorn main:app --reload
```
The API will be available at `http://127.0.0.1:8000`. You can visit `http://127.0.0.1:8000/docs` to test the endpoints interactively via Swagger UI.

### 3. Run the Tests
```bash
pytest tests/test_ingestion.py -v
```

---

## Architectural Decisions

### Custom Chunking Logic & Overlap
We chose to implement a hand-rolled chunking function (approx 500 characters) instead of using LangChain's pre-built splitters to demonstrate a deeper understanding of the mechanics. 

**Why use an overlap? (50 characters)**
When a document is split arbitrarily by size, a boundary might cut right through the middle of a sentence, paragraph, or key idea. If the LLM only retrieves the second half of the idea, it lacks the context from the first half. By using a 50-character overlap, the end of `Chunk A` is repeated at the beginning of `Chunk B`. This ensures that context isn't lost across artificial chunk boundaries, improving the quality of the retrieval phase in later weeks.

### Metadata Storage Strategy
For every chunk stored in ChromaDB, we store a metadata payload containing:
- `source`: The filename of the PDF.
- `page`: The specific page the chunk originated from.
- `chunk_index`: The sequential index of the chunk within the document.

**Why store this metadata?**
In a production RAG system, generating an answer is only half the battle; proving *where* the answer came from is just as important. 
1. The `page` and `source` metadata will be used in future weeks to generate exact **citations** for the user (e.g., "According to document.pdf, Page 4...").
2. The `chunk_index` is useful for **contextual retrieval**. If a retrieved chunk is highly relevant, we can use the `chunk_index` to fetch the chunks immediately before and after it to provide the LLM with a wider context window without muddying the initial vector search.
