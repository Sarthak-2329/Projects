"""
Query pipeline: retrieval, prompt construction, answer generation, and citation parsing.

This is the heart of the RAG system.  It ties together:
  1. The same embedding model used at ingestion time (all-MiniLM-L6-v2)
  2. ChromaDB vector similarity search
  3. A carefully constructed grounding prompt
  4. The provider-agnostic LLM call
  5. Post-processing that maps bracketed reference numbers back to real chunk metadata
"""

import re
from typing import List, Dict, Any, Optional

from app.services.embedding import generate_embeddings
from app.services.llm import generate_answer
from app.database.vector_store import VectorStore


# Module-level store instance — reuses the same ChromaDB collection as ingestion.
_vector_store = VectorStore()


# ---------------------------------------------------------------------------
# 1. Prompt Construction
# ---------------------------------------------------------------------------

def construct_prompt(question: str, chunks: List[Dict[str, Any]]) -> str:
    """
    Build a grounded prompt that instructs the LLM to:
      - Answer ONLY from the provided context chunks.
      - Tag every claim with a bracketed reference number [1], [2], etc.
      - Say "I don't know based on the provided context." if the context
        doesn't cover the question.

    The numbered context blocks use 1-based indexing so the reference
    numbers in the answer map directly to list positions.
    """
    # --- System instructions ---
    system_instructions = (
        "You are a helpful assistant that answers questions based ONLY on the "
        "provided context below. Follow these rules strictly:\n"
        "1. Use ONLY the information in the numbered context chunks to answer.\n"
        "2. For every claim you make, cite the source by appending the chunk's "
        "   reference number in square brackets, e.g. [1], [2].\n"
        "3. If the context does not contain enough information to answer the "
        '   question, respond with exactly: "I don\'t know based on the '
        '   provided context."\n'
        "4. Do NOT use any external knowledge. Do NOT speculate or fabricate.\n"
    )

    # --- Context blocks ---
    # Each chunk is numbered [1], [2], ... so the LLM can reference them.
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        text = chunk.get("text", "")
        source = chunk.get("metadata", {}).get("source", "unknown")
        page = chunk.get("metadata", {}).get("page", "?")
        context_parts.append(
            f"[{i}] (Source: {source}, Page: {page})\n{text}"
        )
    context_block = "\n\n".join(context_parts)

    # --- Final assembled prompt ---
    prompt = (
        f"{system_instructions}\n"
        f"--- CONTEXT ---\n"
        f"{context_block}\n"
        f"--- END CONTEXT ---\n\n"
        f"Question: {question}\n"
        f"Answer:"
    )

    return prompt


# ---------------------------------------------------------------------------
# 2. Citation Parsing
# ---------------------------------------------------------------------------

def parse_citations(
    answer: str, chunks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Extract bracketed reference numbers from the LLM answer and map them
    back to the actual chunk metadata.

    This is the trickiest part of the pipeline, so here's the detailed logic:

    STEP 1 — Find all bracketed numbers in the answer text.
        We use the regex pattern r'\\[(\\d+)\\]' which matches any integer
        inside square brackets.  Examples of what this catches:
          • "The capital is Paris [1]."           → captures '1'
          • "Both reports agree [1][3]."           → captures '1' and '3'
          • "See sources [2, 4]."                 → does NOT directly match
                                                    because of the comma-space,
                                                    so we also handle comma-
                                                    separated lists inside a
                                                    single pair of brackets.

        We handle the "comma-separated inside brackets" case with a second
        regex pass:  r'\\[(\\d+(?:\\s*,\\s*\\d+)+)\\]'  which matches patterns
        like [1, 2] or [1,2,3].  We split those on commas to get individual
        numbers.

    STEP 2 — Convert to 0-based indices.
        The prompt numbers chunks starting at 1, but our chunks list is
        0-indexed.  So reference [1] → chunks[0], [2] → chunks[1], etc.
        We discard any reference number that's out of bounds (e.g. if the
        LLM hallucinates a [99] when there are only 5 chunks).

    STEP 3 — Deduplicate while preserving first-appearance order.
        If the answer cites [1] three times, we only include chunk 1 once
        in the citations array, and its position reflects where it was
        first referenced.

    STEP 4 — Build citation objects.
        Each citation contains:
          • chunk_text:   the full text of the referenced chunk
          • filename:     the source PDF filename
          • page:         the page number within that PDF
          • chunk_index:  the sequential chunk index from ingestion
    """

    # --- STEP 1: Extract all reference numbers ---

    cited_numbers: List[int] = []

    # Pattern A: individual [N] references (covers the common case)
    individual_pattern = re.compile(r'\[(\d+)\]')

    # Pattern B: comma-separated lists like [1, 2, 3]
    # We find these first so we can split them, then also find individual ones.
    comma_list_pattern = re.compile(r'\[(\d+(?:\s*,\s*\d+)+)\]')

    # First, extract comma-separated lists and split them.
    for match in comma_list_pattern.finditer(answer):
        nums_str = match.group(1)  # e.g. "1, 2, 3"
        for num_str in nums_str.split(','):
            num_str = num_str.strip()
            if num_str.isdigit():
                cited_numbers.append(int(num_str))

    # Then, extract individual [N] references.
    # We need to avoid double-counting numbers that were already captured
    # inside comma-separated lists.  To do this, we remove the comma-list
    # matches from the answer before scanning for individual ones.
    answer_without_lists = comma_list_pattern.sub('', answer)
    for match in individual_pattern.finditer(answer_without_lists):
        cited_numbers.append(int(match.group(1)))

    # --- STEP 2 & 3: Convert to 0-based, filter out-of-bounds, deduplicate ---

    seen = set()
    unique_indices: List[int] = []
    for num in cited_numbers:
        zero_based = num - 1  # Convert 1-based reference to 0-based index
        if 0 <= zero_based < len(chunks) and zero_based not in seen:
            seen.add(zero_based)
            unique_indices.append(zero_based)

    # --- STEP 4: Build citation objects ---

    citations = []
    for idx in unique_indices:
        chunk = chunks[idx]
        metadata = chunk.get("metadata", {})
        citations.append({
            "chunk_text": chunk.get("text", ""),
            "filename": metadata.get("source", "unknown"),
            "page": metadata.get("page", 0),
            "chunk_index": metadata.get("chunk_index", 0)
        })

    return citations


# ---------------------------------------------------------------------------
# 3. Query Pipeline Orchestrator
# ---------------------------------------------------------------------------

def run_query(
    question: str,
    document_id: Optional[str] = None,
    top_k: int = 5
) -> Dict[str, Any]:
    """
    End-to-end query pipeline:
      1. Embed the question using the SAME model as ingestion (all-MiniLM-L6-v2).
      2. Retrieve the top-k most similar chunks from ChromaDB.
      3. Construct a grounded prompt with numbered context.
      4. Call the LLM via the provider-agnostic generate_answer().
      5. Parse citations from the answer and map them to chunk metadata.

    Args:
        question:    The user's natural-language question.
        document_id: Optional filename to scope retrieval to one document.
        top_k:       How many chunks to retrieve (default 5).

    Returns:
        A dict with:
          - answer:    The LLM's text response.
          - citations: A list of citation dicts with chunk_text, filename,
                       page, and chunk_index.
    """

    # Step 1: Embed the question.
    # CRITICAL: We reuse the exact same model (all-MiniLM-L6-v2) that was used
    # during ingestion.  Using a different model would produce embeddings in a
    # different vector space, making similarity search meaningless.
    question_embedding = generate_embeddings([question])[0]

    # Step 2: Retrieve top-k chunks.
    chunks = _vector_store.query_chunks(
        query_embedding=question_embedding,
        top_k=top_k,
        document_id=document_id
    )

    # If no chunks were found, we can short-circuit — there's nothing
    # for the LLM to ground its answer on.
    if not chunks:
        return {
            "answer": "I don't know based on the provided context.",
            "citations": []
        }

    # Step 3: Construct the grounded prompt.
    prompt = construct_prompt(question, chunks)

    # Step 4: Generate the answer.
    answer = generate_answer(prompt)

    # Step 5: Parse citations from the answer text.
    citations = parse_citations(answer, chunks)

    return {
        "answer": answer,
        "citations": citations
    }
