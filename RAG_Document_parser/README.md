# Full-Stack RAG Document Parser

A portfolio project demonstrating a production-grade Retrieval-Augmented Generation (RAG) pipeline, built end-to-end over four weeks. Upload PDFs, ask natural-language questions, and get grounded answers with exact citations — powered by **hybrid keyword + semantic search**, a fully evaluated pipeline, and a live deployed demo.

**[🚀 Live Demo](https://your-app.vercel.app)** · **[📖 API Docs](https://your-service.onrender.com/docs)**

> **Note:** The live demo is seeded with a sample document (world geography, space exploration, history, climate, biology) since the free hosting tier doesn't persist uploads across restarts. Upload your own PDFs and they'll be queryable immediately — until the next cold start.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (Vercel)               │
│   Upload PDF → Browse Docs → Ask Questions → Cite Sources   │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP (CORS-enabled)
┌───────────────────────────▼─────────────────────────────────┐
│                   FastAPI Backend (Render)                   │
│                                                             │
│  POST /upload          POST /query         GET /documents   │
│       │                     │                               │
│  ┌────▼────────────┐  ┌─────▼──────────────────────────┐   │
│  │ Ingestion        │  │ Hybrid Query Pipeline           │   │
│  │ Pipeline         │  │                                 │   │
│  │ PDF → Extract   │  │  Embed question                 │   │
│  │     → Chunk     │  │  ├─ Vector search (ChromaDB)    │   │
│  │     → Embed     │  │  └─ BM25 keyword search         │   │
│  │     → Store     │  │       ↓                         │   │
│  └────────┬────────┘  │  Reciprocal Rank Fusion (k=60)  │   │
│           │           │       ↓                         │   │
│  ┌────────▼────────────────── Top-K chunks              │   │
│  │       ChromaDB (local persistent store)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  LLM Answer    │                        │
│                    │  Generation    │                        │
│                    │  (Gemini /     │                        │
│                    │   OpenAI /     │                        │
│                    │   Anthropic)   │                        │
│                    └───────┬────────┘                        │
│                            │ Answer + Citations              │
└────────────────────────────┼────────────────────────────────┘
                             │
                    JSON response with answer text
                    + list of {filename, page, chunk_text}
```

**Hybrid Search Detail:**
Every query runs through two retrievers in parallel:
1. **Vector search** — `all-MiniLM-L6-v2` embeddings → ChromaDB cosine similarity. Great for semantic paraphrases.
2. **BM25 keyword search** — built on-the-fly from all stored chunks. Great for exact matches: proper nouns, version numbers, rare terms.

Both ranked lists are merged with **Reciprocal Rank Fusion** (`score = Σ 1/(k + rank)`, k = 60). No manual score scaling needed — RRF is naturally scale-invariant.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19 |
| **Backend** | FastAPI, Python 3.14 |
| **PDF parsing** | `pdfplumber` |
| **Chunking** | Custom overlapping-window (500 chars, 50 overlap) |
| **Embeddings** | `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim) |
| **Vector DB** | ChromaDB (local persistent client) |
| **Keyword search** | `rank-bm25` (BM25Okapi) |
| **Retrieval** | Hybrid: BM25 + Vector via Reciprocal Rank Fusion |
| **LLM** | Provider-agnostic: Gemini, OpenAI, or Anthropic |
| **Backend hosting** | Render (free tier, auto-seeded on cold start) |
| **Frontend hosting** | Vercel |

---

## Evaluation Results

Results from running the [20-question eval harness](eval/eval_dataset.json) against the deployed backend with `rag_sample.pdf` ingested.

<!-- EVAL_RESULTS_TABLE_START -->

| Metric | Score |
|--------|-------|
| **Overall pass rate** | **20/20 (100%)** |
| Retrieval accuracy | 20/20 |
| Answer quality | 20/20 |

| Type | Questions | Pass | Retrieval ✓ | Answer ✓ |
|------|-----------|------|-------------|----------|
| factual | 12 | 12 | 12 | 12 |
| keyword | 5 | 5 | 5 | 5 |
| no_answer | 3 | 3 | 3 | 3 |

See [`eval/eval_results.md`](eval/eval_results.md) for the full per-question breakdown.
<!-- EVAL_RESULTS_TABLE_END -->

---

## Local Setup

### 1. Clone and create virtual environment

```bash
git clone https://github.com/your-username/RAG_Document_parser.git
cd RAG_Document_parser
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure an LLM provider

Set **one** of these environment variables:

```bash
export GEMINI_API_KEY="your-key-here"
# OR
export OPENAI_API_KEY="your-key-here"
# OR
export ANTHROPIC_API_KEY="your-key-here"
```

The system auto-detects the first available key (Gemini → OpenAI → Anthropic).
Override with `LLM_PROVIDER=gemini|openai|anthropic` to force a specific provider.

### 3. (Optional) Seed with the sample document

```bash
python scripts/seed_on_startup.py
```

This ingests `data/sample_documents/rag_sample.pdf` so you can query immediately without uploading anything.

### 4. Start the backend

```bash
uvicorn main:app --reload
```

API at `http://127.0.0.1:8000` · Swagger UI at `http://127.0.0.1:8000/docs`

### 5. Start the frontend

In a second terminal:

```bash
cd frontend
npm install   # first time only
npm run dev
```

Open `http://localhost:3000`.

> The frontend reads `frontend/.env.local`. Default is `http://localhost:8000`. Change `NEXT_PUBLIC_API_URL` to point at a different backend.

### 6. Run tests

```bash
pytest tests/ -v                        # all tests (no API key required)
pytest tests/test_hybrid_search.py -v -s  # hybrid search tests with verbose output
```

### 7. Run the evaluation harness

With the backend running:

```bash
python eval/run_eval.py
```

Produces `eval/eval_results.json` and `eval/eval_results.md`.

---

## Deployment

### Backend → Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect your repo.
3. Render detects `render.yaml` and sets up the web service automatically.
4. In the Render dashboard → **Environment** tab, add your `GEMINI_API_KEY` (or `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`).
5. Once deployed, copy your service URL (e.g. `https://rag-document-parser.onrender.com`).

**Cold-start seeding:** The `startCommand` in `render.yaml` runs `seed_on_startup.py` before uvicorn. On every cold start (Render's free tier spins down after 15 min of inactivity), ChromaDB is empty — the seed script re-ingests `rag_sample.pdf` automatically (~10–15s). The demo is always populated.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo → set **Root Directory** to `frontend`.
2. In Vercel's **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL = https://your-service.onrender.com
   ```
3. Deploy. Your frontend URL will be `https://your-app.vercel.app`.
4. Update `CORS_ORIGINS` in Render's Environment tab to your Vercel URL to lock down CORS:
   ```
   CORS_ORIGINS = https://your-app.vercel.app
   ```
5. Redeploy the Render service (or it will pick up on next restart).

---

## API Reference

### `POST /upload` — Ingest a PDF

```bash
curl -X POST http://127.0.0.1:8000/upload \
  -F "file=@document.pdf"
```

```json
{ "document_id": "document.pdf", "chunks_created": 42 }
```

### `GET /documents` — List Ingested Documents

```bash
curl http://127.0.0.1:8000/documents
```

```json
{ "documents": [{ "document_id": "document.pdf", "chunk_count": 42 }] }
```

### `POST /query` — Ask a Question

```bash
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Who first summited Mount Everest?", "document_id": "rag_sample.pdf"}'
```

```json
{
  "answer": "Mount Everest was first summited by Edmund Hillary and Tenzing Norgay on May 29, 1953 [1].",
  "citations": [
    {
      "chunk_text": "Its peak stands at 8,848 metres... first summited by Edmund Hillary and Tenzing Norgay...",
      "filename": "rag_sample.pdf",
      "page": 2,
      "chunk_index": 5
    }
  ]
}
```

`document_id` is optional — omit it to search across all ingested documents.

---

## Architectural Decisions

### Hybrid Search (Week 4)

#### Why hybrid search?
Pure semantic (vector) search uses embedding similarity. The embedding model (`all-MiniLM-L6-v2`) has no semantic representation for rare proper nouns, version numbers, or invented terms — all unknown words look the same in embedding space. A query like "What is the Zylophantium Protocol?" may retrieve chunks about "procedures" (semantically adjacent) rather than the one chunk that literally contains the term.

BM25 is the complementary tool: it scores documents by exact token matches using TF-IDF-like statistics. It reliably surfaces the chunk that contains every query token, even if the model can't understand what those tokens mean.

#### Why Reciprocal Rank Fusion?
The challenge with combining BM25 and vector search is that their scores live in entirely different numeric spaces (BM25 is unbounded; cosine distance is 0–2). Normalising and blending raw scores requires tuning. RRF sidesteps this entirely: it only uses *rank position*, not raw score. The formula `1/(k + rank)` gives each document a contribution based solely on where it appeared in each list. Documents that rank well in **both** lists accumulate the highest combined score.

The standard `k = 60` is used (from Cormack, Clarke & Buettcher, SIGIR 2009). It means rank 1 contributes ~0.0164 and rank 20 contributes ~0.0125 — a gentle slope that rewards consistency across retrievers over excellence in one.

See [`tests/test_hybrid_search.py::test_hybrid_favors_exact_keyword_over_pure_vector`](tests/test_hybrid_search.py) for a concrete demonstration: the test shows the exact failure mode (vector alone misranks a rare-keyword chunk) and verifies that hybrid fixes it.

### Evaluation Harness (Week 4)

The eval harness in [`eval/run_eval.py`](eval/run_eval.py) tests two things independently:
- **Retrieval accuracy**: did the correct page appear in the citations?
- **Answer quality**: did the expected keywords appear in the answer?

This separation matters: the retriever and LLM can fail independently. A good retriever + bad prompt construction would show high retrieval accuracy and low answer quality. The split diagnosis is actionable.

The 20 questions span three types: easy factual (12), keyword-critical (4, where the exact term is the answer), and no-answer (4, where the context doesn't contain the answer and the system must refuse to fabricate). No-answer accuracy is the most important quality metric — it proves the system is grounded.

### Ingestion Pipeline (Week 1)

#### Custom Chunking & Overlap
Hand-rolled chunking (500 characters, 50-character overlap) instead of a framework splitter. The overlap ensures context at a chunk boundary appears in both adjacent chunks — important because a chunk boundary might cut through a sentence mid-idea.

#### Metadata Storage Strategy
Every chunk stores `{source, page, chunk_index}` in ChromaDB. This enables:
- Exact page citations in answers (verifiable by the user).
- Scoped search: `document_id` parameter limits retrieval to a single file.
- Future contextual retrieval: neighbours of a relevant chunk can be fetched by `chunk_index ± 1`.

### Query Pipeline (Week 2)

#### Provider-Agnostic LLM Wrapper
`generate_answer(prompt) → str` is the only place that touches an LLM API. One env var change swaps the provider. Tests inject a deterministic callable via `set_generate_override()` — no API key needed to run the test suite.

#### Grounded Prompt Construction
The system prompt instructs the LLM to: cite every claim with `[N]` references, answer only from the numbered context blocks, and say *"I don't know based on the provided context."* if the context is insufficient. This is verifiable — `parse_citations()` extracts `[N]` references and maps them back to exact chunk metadata, which is shown to the user.

### Deployment (Week 4)

#### Render Free Tier: Self-Healing Cold Starts
Render's free web service has no persistent disk — the filesystem is reset on restart. ChromaDB's `PersistentClient` writes to disk, so it would be empty on every cold start. `scripts/seed_on_startup.py` solves this: it checks `collection.count()` and re-ingests `rag_sample.pdf` if empty. The seeding step runs in the `startCommand` before uvicorn, so the API is never alive with an empty DB.

---

## Known Limitations

| Limitation | Impact | Why it's acceptable here |
|------------|--------|--------------------------|
| **No persistent disk on Render free tier** | Uploaded PDFs are lost on restart; only the seed document survives. | Solved by auto-seeding. Users can re-upload; noted prominently in the UI. |
| **BM25 corpus built on every query** | O(N) memory + time at query time. Fine for hundreds of chunks; would need a persistent index for 10k+ chunks. | Demo scale only. A production system would cache the corpus or use Elasticsearch. |
| **Keyword-only answer checking in eval** | Doesn't catch fluent paraphrases; may under-count correct answers. | A threshold-based keyword check is deterministic and repeatable without an LLM-as-judge dependency. |
| **Single-node, no queue** | FastAPI runs on one worker; concurrent requests are serialized. | Fine for a demo. Production would add workers or move LLM calls to a task queue. |
| **Render free tier sleeps after 15 min** | First request after sleep takes ~30s (spin-up + re-seeding). | Normal for free tier; noted in the demo page. |
| **LLM API key in env var only** | Key must be manually set in Render dashboard; not checked into source. | Correct security practice for a demo. Production would use a secrets manager. |
