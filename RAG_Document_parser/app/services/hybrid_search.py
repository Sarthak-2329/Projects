"""
Hybrid search: BM25 keyword search + vector search combined via Reciprocal Rank Fusion (RRF).

WHY HYBRID SEARCH?
  Vector (semantic) search excels at paraphrases and conceptual similarity.
  BM25 (keyword) search excels at exact matches — proper nouns, version numbers,
  acronyms, rare technical terms.  Neither alone is optimal:

    • Pure vector: "What is the Zylophantium Protocol?" may retrieve a chunk about
      "procedures" (semantically close) but miss the one chunk that literally contains
      the words "Zylophantium Protocol."
    • Pure BM25: "What happened after the treaty was ratified?" may miss relevant
      chunks that use "signed," "enacted," or "came into force" instead of "ratified."

  Combining both rankings via RRF gets the best of both worlds without any
  manual score-scaling gymnastics.

HOW RECIPROCAL RANK FUSION WORKS:
  For each retrieval list L, assign every document d a score:
      RRF_score(d) += 1 / (k + rank_of_d_in_L)
  Then sum across all lists L and re-rank by total score.

  k = 60 is the standard default from Cormack, Clarke & Buettcher (2009).
  It controls how steeply the score drops from rank 1 → rank 2.  At k=60:
    rank 1  → 1/61  ≈ 0.0164
    rank 5  → 1/65  ≈ 0.0154
    rank 20 → 1/80  = 0.0125
  The gentle slope means a document appearing at rank 5 in BOTH lists beats a
  document appearing at rank 1 in only one list — which is exactly the right
  behavior for ensemble retrieval.

CORPUS SCOPE:
  BM25 is built from all chunks currently in ChromaDB at query time.  At demo
  scale (hundreds of chunks) this is fast enough (<5ms).  For larger corpora
  a persistent corpus cache would be warranted.
"""

from typing import List, Dict, Any, Optional

from rank_bm25 import BM25Okapi

from app.services.embedding import generate_embeddings
from app.database.vector_store import VectorStore


# Shared VectorStore instance (same ChromaDB collection as ingestion/query).
_vector_store = VectorStore()


# ---------------------------------------------------------------------------
# 1. BM25 corpus builder
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> List[str]:
    """
    Minimal tokenizer: lowercase, split on whitespace.

    BM25Okapi expects a list of tokens per document.  We keep it simple:
    no stopword removal, no stemming.  The goal is exact-keyword matching,
    so preserving terms like "Zylophantium" intact is more important than
    any normalisation gain.
    """
    return text.lower().split()


def build_bm25_index(chunks: List[Dict[str, Any]]):
    """
    Build a BM25Okapi index from a list of chunk dicts (as returned by
    VectorStore.query_chunks or get_all_chunks).

    Returns:
        bm25:   The BM25Okapi instance, ready to score queries.
        chunks: The same list, in the same order as the BM25 corpus rows
                (important — BM25 scores are positionally aligned to this list).
    """
    tokenized_corpus = [_tokenize(c["text"]) for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    return bm25, chunks


# ---------------------------------------------------------------------------
# 2. BM25 search
# ---------------------------------------------------------------------------

def bm25_search(
    query: str,
    bm25: BM25Okapi,
    corpus_chunks: List[Dict[str, Any]],
    top_k: int
) -> List[Dict[str, Any]]:
    """
    Score every chunk in corpus_chunks against query using BM25, then return
    the top_k results in descending score order.

    Args:
        query:         The raw user question string.
        bm25:          Pre-built BM25Okapi index.
        corpus_chunks: Ordered list of chunk dicts aligned with the BM25 corpus.
        top_k:         Number of top results to return.

    Returns:
        List of chunk dicts, each augmented with a "bm25_score" key.
    """
    tokenized_query = _tokenize(query)
    scores = bm25.get_scores(tokenized_query)

    # Pair each chunk with its score and sort descending.
    scored = sorted(
        zip(scores, corpus_chunks),
        key=lambda x: x[0],
        reverse=True
    )

    results = []
    for score, chunk in scored[:top_k]:
        result = dict(chunk)
        result["bm25_score"] = float(score)
        results.append(result)

    return results


# ---------------------------------------------------------------------------
# 3. Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def reciprocal_rank_fusion(
    results_lists: List[List[Dict[str, Any]]],
    k: int = 60
) -> List[Dict[str, Any]]:
    """
    Merge N ranked lists of chunk dicts into a single unified ranking using
    Reciprocal Rank Fusion (RRF).

    Each document's RRF score is the sum of 1/(k + rank) across all lists
    it appears in.  Documents not present in a list contribute 0 for that list.

    Args:
        results_lists: List of ranked lists.  Each inner list is ordered from
                       most to least relevant.  Each item must have "chunk_id".
        k:             RRF constant (default 60, from Cormack et al. 2009).

    Returns:
        A single list of chunk dicts, sorted by descending RRF score.
        Each item has an added "rrf_score" key.
    """
    # Map chunk_id → (score, chunk_dict) accumulated across all lists.
    scores: Dict[str, float] = {}
    chunks_by_id: Dict[str, Dict[str, Any]] = {}

    for ranked_list in results_lists:
        for rank, chunk in enumerate(ranked_list, start=1):
            cid = chunk["chunk_id"]
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
            # Keep the first-seen copy of the chunk dict (all copies are
            # identical in content; the only difference would be score fields
            # from individual retrievers, which we don't need to preserve).
            if cid not in chunks_by_id:
                chunks_by_id[cid] = dict(chunk)

    # Sort by combined RRF score, descending.
    sorted_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)

    fused = []
    for cid in sorted_ids:
        chunk = chunks_by_id[cid]
        chunk["rrf_score"] = scores[cid]
        fused.append(chunk)

    return fused


# ---------------------------------------------------------------------------
# 4. Full corpus fetcher (needed by BM25, which requires all chunks)
# ---------------------------------------------------------------------------

def _get_all_chunks(document_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch every chunk from ChromaDB (optionally filtered by document_id).

    ChromaDB's .get() returns all stored documents without requiring an
    embedding query.  We use this to build the BM25 corpus.

    Returns an empty list if the collection is empty.
    """
    collection = _vector_store.collection
    if collection.count() == 0:
        return []

    # Build optional where filter.
    where = {"source": document_id} if document_id else None
    kwargs = {"include": ["documents", "metadatas"]}
    if where:
        kwargs["where"] = where

    results = collection.get(**kwargs)

    ids = results.get("ids", [])
    documents = results.get("documents", [])
    metadatas = results.get("metadatas", [])

    chunks = []
    for i in range(len(ids)):
        chunks.append({
            "chunk_id": ids[i],
            "text": documents[i],
            "metadata": metadatas[i] or {},
            # BM25 doesn't use distance; vector results will have one.
            "distance": None,
        })
    return chunks


# ---------------------------------------------------------------------------
# 5. Hybrid query orchestrator
# ---------------------------------------------------------------------------

def hybrid_query(
    question: str,
    top_k: int = 5,
    document_id: Optional[str] = None,
    rrf_k: int = 60
) -> List[Dict[str, Any]]:
    """
    Full hybrid retrieval pipeline:
      1. Embed the question → vector search → top-(top_k * 2) results.
      2. Fetch all corpus chunks → build BM25 index → BM25 search → top-(top_k * 2).
      3. Fuse both ranked lists with RRF.
      4. Return the top_k results from the fused ranking.

    We retrieve more than top_k from each individual searcher (2× here) to give
    RRF a wider pool to fuse from.  Documents that rank highly in both lists
    bubble to the top of the fused result; documents that only rank highly in
    one list are demoted.

    Args:
        question:    The user's natural-language question.
        top_k:       Final number of chunks to return after fusion.
        document_id: Optional filename to scope both searches to one document.
        rrf_k:       RRF k constant (default 60).

    Returns:
        A list of up to top_k chunk dicts with an added "rrf_score" key.
    """
    # --- Step 1: Vector search ---
    question_embedding = generate_embeddings([question])[0]
    vector_results = _vector_store.query_chunks(
        query_embedding=question_embedding,
        top_k=top_k * 2,
        document_id=document_id,
    )

    if not vector_results:
        # Nothing in the DB yet.
        return []

    # --- Step 2: BM25 search ---
    # Build the BM25 corpus from all stored chunks (scoped to document_id if set).
    all_chunks = _get_all_chunks(document_id=document_id)
    if not all_chunks:
        # Fall back to pure vector results.
        return vector_results[:top_k]

    bm25, corpus_chunks = build_bm25_index(all_chunks)
    bm25_results = bm25_search(
        query=question,
        bm25=bm25,
        corpus_chunks=corpus_chunks,
        top_k=top_k * 2,
    )

    # --- Step 3: RRF fusion ---
    fused = reciprocal_rank_fusion(
        results_lists=[vector_results, bm25_results],
        k=rrf_k,
    )

    # --- Step 4: Return top_k ---
    return fused[:top_k]
