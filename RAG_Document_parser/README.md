# Full-Stack RAG Document Parser

A portfolio project demonstrating a complete Retrieval-Augmented Generation (RAG) pipeline. **Week 1** handles document ingestion (PDF parsing, chunking, embedding, ChromaDB storage). **Week 2** adds the query pipeline (semantic retrieval, grounded LLM answer generation, and citation parsing). **Week 3** delivers a web frontend (Next.js) that ties everything together — upload PDFs, browse ingested documents, ask questions, and inspect grounded citations.

## Tech Stack
- **Framework**: FastAPI (Python 3.11+)
- **Frontend**: Next.js (App Router) with React
- **Extraction**: `pdfplumber`
- **Chunking**: Custom fixed-size overlapping window function
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`)
- **Vector DB**: ChromaDB (Local Persistent Client)
- **LLM**: Provider-agnostic wrapper supporting Gemini, OpenAI, and Anthropic

## Setup and Running Locally

### 1. Create a Virtual Environment and Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure an LLM Provider
Set one of the following environment variables with a valid API key:
```bash
export GEMINI_API_KEY="your-key-here"
# OR
export OPENAI_API_KEY="your-key-here"
# OR
export ANTHROPIC_API_KEY="your-key-here"
```
The system auto-detects the first available key (priority: Gemini → OpenAI → Anthropic). To force a specific provider, also set `LLM_PROVIDER=gemini|openai|anthropic`.

### 3. Run the FastAPI Server
```bash
uvicorn main:app --reload
```
The API will be available at `http://127.0.0.1:8000`. Visit `http://127.0.0.1:8000/docs` for interactive Swagger UI.

### 4. Run the Tests
```bash
pytest tests/ -v
```
Tests use a deterministic LLM mock — no API key required to run them.

### 5. Run the Web Frontend
In a **second terminal** (keep the backend running):
```bash
cd frontend
npm install    # first time only
npm run dev
```
Open `http://localhost:3000` in your browser.

> **Note:** The frontend calls the backend at the URL defined in `frontend/.env.local`. The default is `http://localhost:8000`. If your backend runs on a different port, update `NEXT_PUBLIC_API_URL` in that file.

---

## API Endpoints

### `POST /upload` — Ingest a PDF
```bash
curl -X POST http://127.0.0.1:8000/upload \
  -F "file=@document.pdf"
```
**Response:**
```json
{ "document_id": "document.pdf", "chunks_created": 42 }
```

### `GET /documents` — List Ingested Documents
```bash
curl http://127.0.0.1:8000/documents
```
**Response:**
```json
{ "documents": [{ "document_id": "document.pdf", "chunk_count": 42 }] }
```

### `POST /query` — Ask a Question (Week 2)
```bash
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the main topic of the document?", "document_id": "document.pdf"}'
```
**Response:**
```json
{
  "answer": "The document discusses renewable energy sources [1], focusing on solar and wind power [2].",
  "citations": [
    {
      "chunk_text": "Renewable energy sources are becoming increasingly...",
      "filename": "document.pdf",
      "page": 1,
      "chunk_index": 0
    },
    {
      "chunk_text": "Solar and wind power have seen significant growth...",
      "filename": "document.pdf",
      "page": 2,
      "chunk_index": 3
    }
  ]
}
```
The `document_id` field is optional — omit it to search across all ingested documents.

---

## Architectural Decisions

### Week 1: Ingestion Pipeline

#### Custom Chunking Logic & Overlap
We chose to implement a hand-rolled chunking function (approx 500 characters) instead of using LangChain's pre-built splitters to demonstrate a deeper understanding of the mechanics.

**Why use an overlap? (50 characters)**
When a document is split arbitrarily by size, a boundary might cut right through the middle of a sentence, paragraph, or key idea. If the LLM only retrieves the second half of the idea, it lacks the context from the first half. By using a 50-character overlap, the end of `Chunk A` is repeated at the beginning of `Chunk B`. This ensures that context isn't lost across artificial chunk boundaries, improving the quality of the retrieval phase.

#### Metadata Storage Strategy
For every chunk stored in ChromaDB, we store a metadata payload containing:
- `source`: The filename of the PDF.
- `page`: The specific page the chunk originated from.
- `chunk_index`: The sequential index of the chunk within the document.

**Why store this metadata?**
In a production RAG system, generating an answer is only half the battle; proving *where* the answer came from is just as important.
1. The `page` and `source` metadata are used in Week 2 to generate exact **citations** for the user (e.g., "According to document.pdf, Page 4...").
2. The `chunk_index` is useful for **contextual retrieval**. If a retrieved chunk is highly relevant, we can use the `chunk_index` to fetch the chunks immediately before and after it to provide the LLM with a wider context window.

### Week 2: Query Pipeline

#### Provider-Agnostic LLM Wrapper
The `generate_answer(prompt) -> str` function is the only place in the codebase that talks to an LLM API. It supports Gemini, OpenAI, and Anthropic behind a single interface, so swapping providers means changing one environment variable — not refactoring calling code. For tests, a `set_generate_override()` hook injects deterministic behavior without any API calls.

#### Grounded Prompt Construction
The system prompt explicitly instructs the LLM to:
1. Answer ONLY from the numbered context chunks provided.
2. Cite every claim with a bracketed reference number `[1]`, `[2]`, etc.
3. Say "I don't know based on the provided context." if the context is insufficient.

This design ensures the system is **provably grounded** — the most important test in the suite verifies that unanswerable questions produce an "I don't know" response rather than a fabricated answer.

#### Citation Parsing
After the LLM generates an answer, a post-processing step:
1. Extracts all bracketed reference numbers (`[1]`, `[2]`, `[1, 2]`, etc.) using regex.
2. Maps 1-based references back to 0-based chunk indices.
3. Filters out-of-bounds references and deduplicates.
4. Builds citation objects with `chunk_text`, `filename`, `page`, and `chunk_index`.

This is the trickiest part of the pipeline — see the heavily commented `parse_citations()` function in `app/services/query.py` for the full walkthrough.

### Week 3: Web Frontend

The frontend is a Next.js (App Router) application in the `frontend/` directory. It communicates with the FastAPI backend entirely via `fetch` — no shared state, no server-side rendering of data.

#### Three-Section Layout
A single page with three logical sections stacked vertically:
1. **Upload** — file input + `POST /upload` + loading/success/error feedback.
2. **Documents** — `GET /documents` on load, clickable cards to scope queries to a specific document.
3. **Chat** — text input + `POST /query`, scrollable Q&A history with inline citations.

#### Citation Display
Each answer shows expandable citation items: `[N] filename — Page P` as the header, and the raw chunk text as the expandable body. This is the visual proof that the system is grounded — the user can verify every claim against the actual source text. See `CitationList.js` for the heavily commented rendering logic.

#### "I Don't Know" Handling
When the LLM responds with a variant of "I don't know based on the provided context", the answer is rendered with a distinct muted style and info icon, clearly distinguishing it from normal answers. This prevents the user from mistaking an unanswerable question for a real finding.
