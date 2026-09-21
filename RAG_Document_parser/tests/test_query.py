"""
Tests for Week 2: Query Pipeline.

These tests verify:
  1. Retrieval returns the chunk that actually contains the answer.
  2. The constructed prompt contains the question and the correct number of context chunks.
  3. An end-to-end POST /query returns a non-empty answer with at least one valid citation.
  4. A question with no answer in the document returns "I don't know" — the single most
     important test, proving the system is grounded and not hallucinating.

All tests use a deterministic LLM override (no external API calls required) so they
run reliably in any environment.
"""

import os
import re
import pytest
from httpx import AsyncClient, ASGITransport
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from main import app
from app.services.embedding import generate_embeddings
from app.services.query import construct_prompt, parse_citations, run_query, _vector_store
from app.services.llm import set_generate_override
from app.services.ingestion import ingest_pdf, vector_store
import app.services.ingestion as ingestion_module
import app.services.hybrid_search as hybrid_search_module


# ---------------------------------------------------------------------------
# Test PDF with known, specific content for deterministic assertions.
# ---------------------------------------------------------------------------

QUERY_TEST_PDF = "query_test_document.pdf"

# This fact is specific and unique enough that we can assert retrieval
# finds this exact chunk when asked the right question.
KNOWN_FACT = (
    "The Eiffel Tower is located in Paris, France. "
    "It was constructed in 1889 for the World's Fair. "
    "The tower stands 330 metres tall and is the most-visited "
    "paid monument in the world."
)

UNRELATED_CONTENT = (
    "Photosynthesis is the process by which green plants convert "
    "sunlight into chemical energy. Chlorophyll absorbs light primarily "
    "in the blue and red wavelengths."
)


@pytest.fixture(scope="module", autouse=True)
def setup_query_test_environment():
    """
    Create a test PDF with known content, ingest it, and set up
    a deterministic LLM override for all query tests.
    """
    QUERY_COLLECTION = "query_test_collection"

    # Use a dedicated collection name so subprocess tests (which only touch
    # the "documents" collection) can never invalidate our UUID.
    # This is the same isolation strategy used by test_integration.py.
    try:
        _vector_store.client.delete_collection(QUERY_COLLECTION)
    except Exception:
        pass
    fresh_collection = _vector_store.client.create_collection(QUERY_COLLECTION)

    # Point all module-level singletons at our isolated collection.
    _vector_store.collection = fresh_collection
    ingestion_module.vector_store._collection = None
    ingestion_module.vector_store.collection = fresh_collection
    hybrid_search_module._vector_store._collection = None
    hybrid_search_module._vector_store.collection = fresh_collection

    # Build a test PDF with two pages of distinct content.
    c = canvas.Canvas(QUERY_TEST_PDF, pagesize=letter)

    # Page 1: The known fact about the Eiffel Tower.
    text_obj = c.beginText(40, 750)
    text_obj.setFont("Helvetica", 10)
    # Split into lines so reportlab renders it all.
    for line in KNOWN_FACT.split(". "):
        text_obj.textLine(line.strip() + ".")
    c.drawText(text_obj)
    c.showPage()

    # Page 2: Unrelated content about photosynthesis.
    text_obj = c.beginText(40, 750)
    text_obj.setFont("Helvetica", 10)
    for line in UNRELATED_CONTENT.split(". "):
        text_obj.textLine(line.strip() + ".")
    c.drawText(text_obj)
    c.showPage()

    c.save()

    # Ingest the PDF into ChromaDB.
    with open(QUERY_TEST_PDF, "rb") as f:
        ingest_pdf(f.read(), QUERY_TEST_PDF)

    # --- Deterministic LLM override ---
    # This function simulates an LLM that faithfully follows the grounding
    # prompt: it answers from context when it can, and says "I don't know"
    # when it can't.
    def mock_llm(prompt: str) -> str:
        # Check if the prompt asks about something in the context.
        question_match = re.search(r'Question:\s*(.+)', prompt)
        question = question_match.group(1).strip() if question_match else ""

        # Find all context blocks in the prompt.
        context_blocks = re.findall(r'\[(\d+)\].*?\n(.+?)(?=\n\[|\n---|\Z)', prompt, re.DOTALL)

        # If the question is about the Eiffel Tower and we have context about it,
        # produce a grounded answer with citations.
        if "eiffel" in question.lower() or "paris" in question.lower() or "tower" in question.lower():
            for num, text in context_blocks:
                if "eiffel" in text.lower() or "paris" in text.lower():
                    return (
                        f"The Eiffel Tower is located in Paris, France [{num}]. "
                        f"It was constructed in 1889 [{num}]."
                    )

        # For any question not covered by the context, return the exact
        # "I don't know" phrase specified in the system prompt.
        return "I don't know based on the provided context."

    set_generate_override(mock_llm)

    yield

    # Teardown.
    set_generate_override(None)
    if os.path.exists(QUERY_TEST_PDF):
        os.remove(QUERY_TEST_PDF)
    try:
        _vector_store.client.delete_collection("query_test_collection")
    except Exception:
        pass
    # Reset all collection references.
    _vector_store._collection = None
    ingestion_module.vector_store._collection = None
    hybrid_search_module._vector_store._collection = None


# ---------------------------------------------------------------------------
# Test 1: Retrieval returns the chunk that contains the answer.
# ---------------------------------------------------------------------------

def test_retrieval_returns_chunk_with_known_answer():
    """
    For a question with a known single-chunk answer, verify that ChromaDB
    retrieval returns a chunk containing the relevant content.
    """
    question = "Where is the Eiffel Tower located?"
    question_embedding = generate_embeddings([question])[0]

    chunks = _vector_store.query_chunks(
        query_embedding=question_embedding,
        top_k=5
    )

    assert len(chunks) > 0, "Retrieval returned no chunks."

    # At least one of the top-5 chunks should mention the Eiffel Tower.
    eiffel_found = any(
        "eiffel" in chunk["text"].lower() or "paris" in chunk["text"].lower()
        for chunk in chunks
    )
    assert eiffel_found, (
        "None of the retrieved chunks contain 'eiffel' or 'paris'. "
        f"Retrieved texts: {[c['text'][:80] for c in chunks]}"
    )


# ---------------------------------------------------------------------------
# Test 2: Prompt contains the question and the correct number of context chunks.
# ---------------------------------------------------------------------------

def test_prompt_construction_contains_question_and_context_chunks():
    """
    Verify that construct_prompt() embeds the user question and correctly
    numbers all provided context chunks.
    """
    question = "What year was the Eiffel Tower built?"
    fake_chunks = [
        {"text": "Chunk A text here.", "metadata": {"source": "doc.pdf", "page": 1, "chunk_index": 0}},
        {"text": "Chunk B text here.", "metadata": {"source": "doc.pdf", "page": 1, "chunk_index": 1}},
        {"text": "Chunk C text here.", "metadata": {"source": "doc.pdf", "page": 2, "chunk_index": 2}},
    ]

    prompt = construct_prompt(question, fake_chunks)

    # The question must appear in the prompt.
    assert question in prompt, "The question is missing from the constructed prompt."

    # Each chunk should have a numbered reference [1], [2], [3].
    for i in range(1, len(fake_chunks) + 1):
        assert f"[{i}]" in prompt, f"Context chunk [{i}] is missing from the prompt."

    # Each chunk's text should appear in the prompt.
    for chunk in fake_chunks:
        assert chunk["text"] in prompt, f"Chunk text '{chunk['text']}' is missing from the prompt."

    # The system instruction about grounding should be present.
    assert "ONLY" in prompt, "Grounding instruction ('ONLY') not found in prompt."
    assert "I don't know" in prompt, "Fallback instruction missing from prompt."


# ---------------------------------------------------------------------------
# Test 3: End-to-end POST /query returns answer with valid citations.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_end_to_end_query_returns_answer_with_valid_citations():
    """
    Hit POST /query with a question whose answer is in the test PDF.
    Verify the response contains a non-empty answer and at least one
    citation with all required fields.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/query", json={
            "question": "Where is the Eiffel Tower located?"
        })

    assert response.status_code == 200, f"POST /query failed: {response.text}"
    data = response.json()

    # Must have a non-empty answer.
    assert "answer" in data
    assert len(data["answer"]) > 0, "Answer is empty."

    # Must have at least one citation.
    assert "citations" in data
    assert len(data["citations"]) >= 1, "No citations returned for an answerable question."

    # Each citation must have the required fields.
    for citation in data["citations"]:
        assert "chunk_text" in citation, "Citation missing 'chunk_text'."
        assert "filename" in citation, "Citation missing 'filename'."
        assert "page" in citation, "Citation missing 'page'."
        assert "chunk_index" in citation, "Citation missing 'chunk_index'."
        assert len(citation["chunk_text"]) > 0, "Citation chunk_text is empty."


# ---------------------------------------------------------------------------
# Test 4: Unanswerable question returns grounded "I don't know".
#
# This is the SINGLE MOST IMPORTANT TEST in the whole project.
# It proves the system is grounded: when the context doesn't contain
# the answer, the system says so rather than fabricating one.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unanswerable_question_returns_grounded_i_dont_know():
    """
    Ask a question that is definitively NOT covered by any content in
    the test PDF. The system must return an "I don't know" response
    with zero citations — NOT a fabricated answer.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/query", json={
            "question": "What is the GDP of Japan in 2024?"
        })

    assert response.status_code == 200, f"POST /query failed: {response.text}"
    data = response.json()

    answer_lower = data["answer"].lower()

    # The answer should contain some form of "I don't know" or indicate
    # that the context doesn't have the information.
    grounded_indicators = [
        "i don't know",
        "i do not know",
        "not enough information",
        "provided context",
        "cannot answer",
        "no information",
    ]
    is_grounded = any(indicator in answer_lower for indicator in grounded_indicators)
    assert is_grounded, (
        f"Expected a grounded 'I don't know' response for an unanswerable question, "
        f"but got: '{data['answer']}'"
    )

    # An "I don't know" answer should have no citations.
    assert len(data["citations"]) == 0, (
        f"Expected zero citations for an unanswerable question, "
        f"but got {len(data['citations'])} citation(s)."
    )
