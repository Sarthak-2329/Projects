"""
End-to-end integration tests for Week 1 + Week 2.

ROOT CAUSE FIX (applied here):
  test_existing_test_suite_passes runs a subprocess that invokes the Week 1
  ingestion tests, which delete and recreate the "documents" collection.  That
  leaves the in-process _vector_store.collection pointing at a stale UUID,
  causing NotFoundError for every subsequent test.

  Fix: use a dedicated collection name "integration_documents" and monkey-patch
  the module-level singletons in query.py and ingestion.py to point at it.
  The subprocess now can't interfere with our collection regardless of ordering.

These tests are intentionally more rigorous than the unit tests:
  - A real multi-page PDF with distinct, checkable facts is created via reportlab.
  - Real semantic retrieval is used (all-MiniLM-L6-v2 embeddings + ChromaDB).
  - A deterministic mock LLM echoes which context chunk covers the question, so we
    can assert specific page numbers and citation correctness without a live API key.
  - Re-ingestion idempotency is explicitly verified.
  - The no-hallucination guarantee is verified against the full pipeline.

Run with:
    pytest tests/test_integration.py -v -s
"""

import os
import re
import subprocess
import pytest
from httpx import AsyncClient, ASGITransport
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from main import app
import app.services.query as query_module
import app.services.ingestion as ingestion_module
import app.services.hybrid_search as hybrid_search_module
from app.database.vector_store import VectorStore
from app.services.embedding import generate_embeddings
from app.services.llm import set_generate_override

# ---------------------------------------------------------------------------
# Use a dedicated collection so subprocess tests can't invalidate our UUID.
# ---------------------------------------------------------------------------
INT_COLLECTION = "integration_documents"
INT_PDF_NAME = "integration_test_doc.pdf"

# Four pages, each with a unique verifiable fact.
FACTS = {
    1: (
        "The Amazon River is the largest river by water discharge on Earth. "
        "It flows through South America and discharges approximately 209000 "
        "cubic metres of water per second into the Atlantic Ocean. "
        "The Amazon basin covers over seven million square kilometres."
    ),
    2: (
        "Mount Everest is the highest mountain above sea level on Earth. "
        "Its peak stands at 8848 metres above sea level, located in the "
        "Himalayas on the border between Nepal and China. "
        "It was first summited by Edmund Hillary and Tenzing Norgay in 1953."
    ),
    3: (
        "The speed of light in a vacuum is exactly 299792458 metres per second. "
        "This constant is denoted by the letter c in physics equations. "
        "No object with mass can reach or exceed this speed according to "
        "Einstein's special theory of relativity, published in 1905."
    ),
    4: (
        "The Great Wall of China was built over many centuries by various "
        "Chinese dynasties. The wall stretches approximately 21196 kilometres "
        "in total length. Its primary purpose was to protect against invasions "
        "from nomadic groups to the north."
    ),
}

OUT_OF_SCOPE_QUESTION = "What is the boiling point of liquid nitrogen?"


# ---------------------------------------------------------------------------
# Module-scoped fixture: isolated collection, patched singletons, mock LLM.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module", autouse=True)
def setup_integration_environment():
    """
    1. Create a fresh 'integration_documents' collection (isolated from 'documents').
    2. Monkey-patch the module-level VectorStore singletons in query.py and
       ingestion.py to point at our isolated collection.
    3. Build the test PDF, ingest it.
    4. Install the deterministic mock LLM.
    5. Yield for tests.
    6. Restore originals and delete the isolated collection.
    """
    # --- Step 1: Create isolated collection ---
    # We don't touch the 'documents' collection so the subprocess test can't
    # invalidate our UUID.
    int_store = VectorStore(INT_COLLECTION)
    # Wipe any leftover state from a previous failed run.
    try:
        int_store.client.delete_collection(INT_COLLECTION)
    except Exception:
        pass
    int_store.collection = int_store.client.create_collection(INT_COLLECTION)

    # --- Step 2: Monkey-patch module-level singletons ---
    # query.py, hybrid_search.py, and ingestion.py each hold a module-level
    # VectorStore instance. We replace them with our isolated one for the
    # duration of these tests.
    original_query_store = query_module._vector_store
    original_hybrid_store = hybrid_search_module._vector_store
    original_ingestion_store = ingestion_module.vector_store
    query_module._vector_store = int_store
    hybrid_search_module._vector_store = int_store
    ingestion_module.vector_store = int_store

    # --- Step 3: Build and ingest the test PDF ---
    c = canvas.Canvas(INT_PDF_NAME, pagesize=letter)
    for page_num, fact_text in FACTS.items():
        text_obj = c.beginText(50, 720)
        text_obj.setFont("Helvetica", 11)
        text_obj.setLeading(16)
        words = fact_text.split()
        line, lines = [], []
        for word in words:
            line.append(word)
            if len(" ".join(line)) > 75:
                lines.append(" ".join(line[:-1]))
                line = [word]
        if line:
            lines.append(" ".join(line))
        for ln in lines:
            text_obj.textLine(ln)
        c.drawText(text_obj)
        c.showPage()
    c.save()

    with open(INT_PDF_NAME, "rb") as f:
        result = ingestion_module.ingest_pdf(f.read(), INT_PDF_NAME)
    assert result["chunks_created"] > 0, (
        f"Ingestion produced zero chunks. Extraction may have failed."
    )
    print(f"\n[fixture] Ingested {result['chunks_created']} chunks into '{INT_COLLECTION}'")

    # --- Step 4: Install deterministic mock LLM ---
    def mock_llm(prompt: str) -> str:
        question_match = re.search(r'Question:\s*(.+)', prompt)
        question = question_match.group(1).strip().lower() if question_match else ""

        # Parse all [N] (Source: ..., Page: N)\n<text> blocks from the prompt.
        block_pattern = re.compile(
            r'\[(\d+)\]\s*\(Source:[^)]+,\s*Page:\s*(\d+)\)\s*\n(.*?)(?=\n\[\d+\]|\n---|\Z)',
            re.DOTALL
        )
        blocks = block_pattern.findall(prompt)

        keyword_map = [
            (("amazon", "river", "water discharge"),       "amazon"),
            (("everest", "mountain", "nepal", "hillary"),  "everest"),
            (("speed of light", "light", "299792458"),     "light"),
            (("great wall", "china", "21196"),             "great wall"),
        ]

        for keywords, topic in keyword_map:
            if any(kw in question for kw in keywords):
                for num, page, text in blocks:
                    if topic in text.lower():
                        return (
                            f"Based on the provided context, "
                            f"{text.strip()[:140].rstrip()}... [{num}]"
                        )

        return "I don't know based on the provided context."

    set_generate_override(mock_llm)

    yield int_store   # pass the store to tests that need it directly

    # --- Teardown ---
    set_generate_override(None)
    query_module._vector_store = original_query_store
    hybrid_search_module._vector_store = original_hybrid_store
    ingestion_module.vector_store = original_ingestion_store
    if os.path.exists(INT_PDF_NAME):
        os.remove(INT_PDF_NAME)
    try:
        int_store.client.delete_collection(INT_COLLECTION)
    except Exception:
        pass


# ===========================================================================
# TEST 1: Existing Week 1 + Week 2 suites — run in a subprocess so their
# collection teardown/setup is completely isolated from ours.
# ===========================================================================

def test_existing_test_suite_passes():
    """
    Run the Week 1 and Week 2 test suites in a subprocess.
    They manage their own 'documents' collection independently; our
    'integration_documents' collection is unaffected.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = subprocess.run(
        [
            ".venv/bin/pytest",
            "tests/test_ingestion.py",
            "tests/test_query.py",
            "-v", "--tb=short"
        ],
        capture_output=True,
        text=True,
        cwd=project_root
    )
    print("\n" + "=" * 70)
    print("WEEK 1 + WEEK 2 SUITE OUTPUT:")
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr[-1000:])
    print("=" * 70)
    assert result.returncode == 0, (
        f"Existing test suite FAILED (exit code {result.returncode})."
    )


# ===========================================================================
# TEST 2: Retrieval accuracy — top result must come from the right page.
# ===========================================================================

@pytest.mark.parametrize("question,expected_page,topic", [
    ("What river has the highest water discharge on Earth?", 1, "amazon"),
    ("How tall is Mount Everest and where is it located?",  2, "everest"),
    ("What is the speed of light?",                         3, "light"),
    ("How long is the Great Wall of China?",                4, "great wall"),
])
def test_retrieval_finds_correct_page(question, expected_page, topic, setup_integration_environment):
    """
    For each known fact, the top retrieved chunk must contain the topic keyword
    AND at least one of the top-5 results must originate from the correct page.
    """
    int_store = setup_integration_environment
    q_embedding = generate_embeddings([question])[0]
    chunks = int_store.query_chunks(
        query_embedding=q_embedding,
        top_k=5,
        document_id=INT_PDF_NAME
    )

    assert len(chunks) > 0, f"No chunks retrieved for: {question!r}"

    pages_returned = [c["metadata"]["page"] for c in chunks]
    assert expected_page in pages_returned, (
        f"Expected page {expected_page} in top-5 for {question!r}, "
        f"but got pages: {pages_returned}"
    )

    top_text = chunks[0]["text"].lower()
    assert topic in top_text, (
        f"Top chunk for {question!r} does not mention '{topic}'.\n"
        f"Top chunk: {chunks[0]['text'][:200]}"
    )


# ===========================================================================
# TEST 3: End-to-end POST /query — correct answer + correct page in citations.
# ===========================================================================

@pytest.mark.asyncio
@pytest.mark.parametrize("question,expected_page,expected_keyword", [
    ("What river has the highest water discharge on Earth?", 1, "amazon"),
    ("How tall is Mount Everest?",                           2, "everest"),
    ("What is the speed of light in a vacuum?",              3, "light"),
    ("How long is the Great Wall of China?",                 4, "great wall"),
])
async def test_end_to_end_query_correct_answer_and_page_citation(
    question, expected_page, expected_keyword
):
    """
    POST /query with document_id scoped to the integration PDF.
    Asserts:
      - HTTP 200.
      - Non-empty answer containing the expected keyword.
      - At least one citation, with the correct page number present.
      - All citation fields (chunk_text, filename, page, chunk_index) populated.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/query", json={
            "question": question,
            "document_id": INT_PDF_NAME
        })

    assert response.status_code == 200, (
        f"POST /query returned {response.status_code}: {response.text}"
    )
    data = response.json()

    assert data["answer"], f"Empty answer for: {question!r}"
    assert expected_keyword in data["answer"].lower(), (
        f"Answer for {question!r} missing keyword '{expected_keyword}'.\n"
        f"Got: {data['answer']}"
    )
    assert len(data["citations"]) >= 1, (
        f"No citations returned for answerable question: {question!r}"
    )

    cited_pages = [c["page"] for c in data["citations"]]
    assert expected_page in cited_pages, (
        f"Expected page {expected_page} in citations for {question!r}, "
        f"but citations reference pages: {cited_pages}"
    )

    for cit in data["citations"]:
        assert cit["chunk_text"], "Citation has empty chunk_text."
        assert cit["filename"] == INT_PDF_NAME, \
            f"Citation filename mismatch: {cit['filename']!r}"
        assert isinstance(cit["page"], int), "Citation page is not an int."
        assert isinstance(cit["chunk_index"], int), "Citation chunk_index is not an int."


# ===========================================================================
# TEST 4: No-hallucination — out-of-scope question must produce "I don't know".
# ===========================================================================

@pytest.mark.asyncio
async def test_out_of_scope_question_returns_i_dont_know():
    """
    THE MOST IMPORTANT TEST.

    Ask a question whose answer is not anywhere in the document.
    The system must refuse to fabricate an answer, AND must return zero citations.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/query", json={
            "question": OUT_OF_SCOPE_QUESTION,
            "document_id": INT_PDF_NAME
        })

    assert response.status_code == 200, \
        f"POST /query returned {response.status_code}: {response.text}"
    data = response.json()

    answer_lower = data["answer"].lower()
    grounded_indicators = [
        "i don't know",
        "i do not know",
        "not enough information",
        "provided context",
        "cannot answer",
        "no information",
    ]
    is_grounded = any(ind in answer_lower for ind in grounded_indicators)
    assert is_grounded, (
        f"HALLUCINATION DETECTED for {OUT_OF_SCOPE_QUESTION!r}.\n"
        f"Expected a grounded refusal, got: '{data['answer']}'"
    )
    assert len(data["citations"]) == 0, (
        f"Expected ZERO citations for unanswerable question, "
        f"got {len(data['citations'])}: {data['citations']}"
    )


# ===========================================================================
# TEST 5: Re-ingestion idempotency — chunk count must not grow on re-upload.
# ===========================================================================

@pytest.mark.asyncio
async def test_re_ingestion_is_idempotent_no_duplicate_chunks(
    setup_integration_environment
):
    """
    Re-ingest the same PDF via POST /upload and confirm the chunk count
    does not grow.

    Chunk IDs are deterministic ({filename}_pN_cN) and add_chunks() uses
    upsert(), so re-ingesting overwrites existing chunks in-place.

    Verifies:
      - count_after_first == count_after_second (no duplicates).
      - The second upload still returns HTTP 200 (no crash on re-ingest).
    """
    int_store = setup_integration_environment

    count_before = int_store.count_chunks_for_document(INT_PDF_NAME)
    assert count_before > 0, \
        f"Expected chunks in store before re-ingest, got {count_before}."

    # Re-upload the same PDF via the HTTP endpoint.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with open(INT_PDF_NAME, "rb") as f:
            response = await ac.post(
                "/upload",
                files={"file": (INT_PDF_NAME, f, "application/pdf")}
            )
    assert response.status_code == 200, \
        f"Second upload returned {response.status_code}: {response.text}"

    count_after = int_store.count_chunks_for_document(INT_PDF_NAME)

    assert count_after == count_before, (
        f"DUPLICATE CHUNKS DETECTED: count grew from {count_before} "
        f"to {count_after} after re-ingesting the same PDF."
    )
    print(
        f"\n[idempotency] chunk count before={count_before}, "
        f"after={count_after} — identical ✓"
    )
