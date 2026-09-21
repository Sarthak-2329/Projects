"""
seed_on_startup.py — Seed ChromaDB with the sample PDF on every cold start.

WHY THIS EXISTS:
  Render's free web service tier does NOT provide a persistent disk.
  ChromaDB's PersistentClient writes to the local filesystem, which is reset
  on every deploy or after the instance sleeps and restarts.

  This script runs BEFORE uvicorn starts (see render.yaml startCommand).
  It checks whether ChromaDB already has documents.  If empty, it ingests
  rag_sample.pdf so the live demo always has queryable content.

  Re-ingestion is idempotent: chunk IDs are deterministic ({source}_pN_cN),
  so running this script multiple times on a non-empty collection is safe —
  ChromaDB's upsert() will simply overwrite the same IDs.

USAGE (run from project root):
    python scripts/seed_on_startup.py
"""

import os
import sys
from pathlib import Path

# Ensure the project root is on the Python path so app.* imports work.
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

SAMPLE_PDF_PATH = PROJECT_ROOT / "data" / "sample_documents" / "rag_sample.pdf"


def seed() -> None:
    from app.database.vector_store import VectorStore
    from app.services.ingestion import ingest_pdf

    store = VectorStore()
    count = store.collection.count()

    print(f"[seed] ChromaDB chunk count on startup: {count}")

    if count > 0:
        print("[seed] Database already populated — skipping seeding.")
        return

    if not SAMPLE_PDF_PATH.exists():
        print(
            f"[seed] WARNING: Sample PDF not found at {SAMPLE_PDF_PATH}. "
            "Run `python scripts/generate_sample_pdf.py` to create it. "
            "Skipping seeding — the API will work but have no documents."
        )
        return

    print(f"[seed] Seeding from {SAMPLE_PDF_PATH} ...")
    with open(SAMPLE_PDF_PATH, "rb") as f:
        result = ingest_pdf(f.read(), SAMPLE_PDF_PATH.name)

    print(
        f"[seed] ✓ Ingestion complete: "
        f"{result['chunks_created']} chunks from '{result['document_id']}'"
    )


if __name__ == "__main__":
    seed()
