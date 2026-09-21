"""
run_eval.py — Evaluation harness for the RAG Document Parser.

Measures two things for each question in eval_dataset.json:

  RETRIEVAL ACCURACY
    Correct if any citation returned by /query has a page number matching
    expected_source_page.  For "no_answer" questions, retrieval is considered
    correct if the answer signals "I don't know" (no page to match against).

  ANSWER QUALITY
    Correct if ALL expected_keywords appear (case-insensitive) in the answer.
    For "no_answer" questions, correct if the answer contains any of the
    expected_keywords (which are phrases like "don't know", "provided context").

USAGE:
    # Make sure the backend is running and rag_sample.pdf is ingested.
    python eval/run_eval.py

    # Against a deployed backend:
    EVAL_API_URL=https://your-service.onrender.com python eval/run_eval.py

OUTPUT:
    eval/eval_results.json  — machine-readable results
    eval/eval_results.md    — human-readable results table (commit this)
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

DATASET_PATH = SCRIPT_DIR / "eval_dataset.json"
RESULTS_JSON_PATH = SCRIPT_DIR / "eval_results.json"
RESULTS_MD_PATH = SCRIPT_DIR / "eval_results.md"

API_BASE = os.environ.get("EVAL_API_URL", "http://localhost:8000")
QUERY_ENDPOINT = f"{API_BASE}/query"
REQUEST_TIMEOUT = 60.0
# Small delay between requests to avoid overwhelming a free-tier backend.
INTER_REQUEST_DELAY = 0.5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def check_answer_quality(answer: str, expected_keywords: list, q_type: str) -> bool:
    """
    For factual/keyword questions: ALL expected keywords must appear in answer.
    For no_answer questions: ANY of the expected keywords must appear in answer
    (they are alternative phrasings of "I don't know").
    """
    answer_lower = answer.lower()
    if q_type == "no_answer":
        return any(kw.lower() in answer_lower for kw in expected_keywords)
    else:
        return all(kw.lower() in answer_lower for kw in expected_keywords)


def check_retrieval_accuracy(citations: list, expected_page, q_type: str, answer: str) -> bool:
    """
    For factual/keyword questions: at least one citation must match expected_source_page.
    For no_answer questions: correct if the answer is a grounded refusal (no page needed).
    """
    if q_type == "no_answer":
        answer_lower = answer.lower()
        return any(phrase in answer_lower for phrase in [
            "don't know", "do not know", "provided context",
            "cannot answer", "not enough", "no information"
        ])
    if expected_page is None:
        return False
    return any(int(c.get("page", -1)) == expected_page for c in citations)


def call_query(question: str, retries: int = 3) -> dict:
    """Call /query with retry on transient errors."""
    for attempt in range(retries):
        try:
            response = httpx.post(
                QUERY_ENDPOINT,
                json={"question": question},
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 503) and attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"    [retry {attempt + 1}] Status {e.response.status_code}, waiting {wait}s...")
                time.sleep(wait)
            else:
                raise
        except httpx.ReadTimeout:
            if attempt < retries - 1:
                print(f"    [retry {attempt + 1}] Timeout, waiting 15s...")
                time.sleep(15)
            else:
                raise


# ---------------------------------------------------------------------------
# Main evaluation loop
# ---------------------------------------------------------------------------

def run_eval() -> None:
    print(f"\n{'='*60}")
    print(f"RAG Evaluation Harness")
    print(f"Backend: {API_BASE}")
    print(f"Dataset: {DATASET_PATH}")
    print(f"{'='*60}\n")

    # Load dataset.
    with open(DATASET_PATH) as f:
        questions = json.load(f)

    results = []
    by_type = {"factual": [], "keyword": [], "no_answer": []}

    for i, q in enumerate(questions, 1):
        qid = q["id"]
        q_type = q["type"]
        question = q["question"]
        expected_keywords = q["expected_keywords"]
        expected_page = q.get("expected_source_page")

        print(f"[{i:02d}/{len(questions)}] {qid} ({q_type}): {question[:70]}")

        try:
            response = call_query(question)
            answer = response.get("answer", "")
            citations = response.get("citations", [])

            retrieval_ok = check_retrieval_accuracy(citations, expected_page, q_type, answer)
            answer_ok = check_answer_quality(answer, expected_keywords, q_type)

            status = "PASS" if (retrieval_ok and answer_ok) else "FAIL"

            result = {
                "id": qid,
                "type": q_type,
                "question": question,
                "retrieval_correct": retrieval_ok,
                "answer_correct": answer_ok,
                "pass": retrieval_ok and answer_ok,
                "answer_snippet": answer[:200],
                "citation_pages": [c.get("page") for c in citations],
                "expected_page": expected_page,
            }

            print(f"    → {status} | retrieval={'✓' if retrieval_ok else '✗'} answer={'✓' if answer_ok else '✗'}")
            print(f"    answer: {answer[:100]}...")

        except Exception as e:
            print(f"    → ERROR: {e}")
            result = {
                "id": qid,
                "type": q_type,
                "question": question,
                "retrieval_correct": False,
                "answer_correct": False,
                "pass": False,
                "error": str(e),
                "answer_snippet": "",
                "citation_pages": [],
                "expected_page": expected_page,
            }

        results.append(result)
        by_type[q_type].append(result)

        if i < len(questions):
            time.sleep(INTER_REQUEST_DELAY)

    # ---------------------------------------------------------------------------
    # Aggregate stats
    # ---------------------------------------------------------------------------

    total = len(results)
    total_pass = sum(1 for r in results if r["pass"])
    total_retrieval = sum(1 for r in results if r["retrieval_correct"])
    total_answer = sum(1 for r in results if r["answer_correct"])

    type_stats = {}
    for t, tresults in by_type.items():
        if not tresults:
            continue
        type_stats[t] = {
            "total": len(tresults),
            "pass": sum(1 for r in tresults if r["pass"]),
            "retrieval": sum(1 for r in tresults if r["retrieval_correct"]),
            "answer": sum(1 for r in tresults if r["answer_correct"]),
        }

    run_timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # ---------------------------------------------------------------------------
    # Write JSON results
    # ---------------------------------------------------------------------------

    output = {
        "run_timestamp": run_timestamp,
        "api_url": API_BASE,
        "total_questions": total,
        "overall_pass_rate": f"{total_pass}/{total} ({100*total_pass//total}%)" if total else "0/0",
        "retrieval_accuracy": f"{total_retrieval}/{total}",
        "answer_accuracy": f"{total_answer}/{total}",
        "by_type": type_stats,
        "results": results,
    }

    with open(RESULTS_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n✓ JSON results written to {RESULTS_JSON_PATH}")

    # ---------------------------------------------------------------------------
    # Write Markdown results
    # ---------------------------------------------------------------------------

    lines = []
    lines.append("# RAG Evaluation Results\n")
    lines.append(f"**Run:** {run_timestamp}  ")
    lines.append(f"**Backend:** `{API_BASE}`  ")
    lines.append(f"**Dataset:** `eval/eval_dataset.json` ({total} questions)\n")

    lines.append("## Summary\n")
    lines.append("| Metric | Score |")
    lines.append("|--------|-------|")
    lines.append(f"| **Overall pass rate** | {total_pass}/{total} ({100*total_pass//total if total else 0}%) |")
    lines.append(f"| Retrieval accuracy | {total_retrieval}/{total} |")
    lines.append(f"| Answer quality | {total_answer}/{total} |")
    lines.append("")

    lines.append("## Results by Question Type\n")
    lines.append("| Type | Questions | Pass | Retrieval ✓ | Answer ✓ |")
    lines.append("|------|-----------|------|-------------|----------|")
    for t, s in type_stats.items():
        lines.append(
            f"| {t} | {s['total']} | {s['pass']} | {s['retrieval']} | {s['answer']} |"
        )
    lines.append("")

    lines.append("## Per-Question Breakdown\n")
    lines.append("| ID | Type | Pass | Retrieval | Answer | Question |")
    lines.append("|----|------|------|-----------|--------|----------|")
    for r in results:
        ret_icon = "✓" if r["retrieval_correct"] else "✗"
        ans_icon = "✓" if r["answer_correct"] else "✗"
        pass_icon = "✅" if r["pass"] else "❌"
        q_short = r["question"][:55] + ("…" if len(r["question"]) > 55 else "")
        lines.append(
            f"| {r['id']} | {r['type']} | {pass_icon} | {ret_icon} | {ans_icon} | {q_short} |"
        )
    lines.append("")

    lines.append("## Notes\n")
    lines.append(
        "- **Retrieval accuracy**: correct if any returned citation matches "
        "`expected_source_page`. For `no_answer` questions, correct if the "
        "system returned a grounded refusal rather than a fabricated answer.\n"
    )
    lines.append(
        "- **Answer quality**: correct if all `expected_keywords` appear "
        "(case-insensitive) in the answer. For `no_answer` questions, correct "
        "if any 'I don't know' phrasing is present.\n"
    )
    lines.append(
        "- Results are generated by `eval/run_eval.py` against `rag_sample.pdf`. "
        "Re-run after any change to the retrieval or generation pipeline.\n"
    )

    with open(RESULTS_MD_PATH, "w") as f:
        f.write("\n".join(lines))
    print(f"✓ Markdown results written to {RESULTS_MD_PATH}\n")

    # ---------------------------------------------------------------------------
    # Print summary
    # ---------------------------------------------------------------------------

    print(f"\n{'='*60}")
    print(f"RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"  Overall pass rate:   {total_pass}/{total} ({100*total_pass//total if total else 0}%)")
    print(f"  Retrieval accuracy:  {total_retrieval}/{total}")
    print(f"  Answer quality:      {total_answer}/{total}")
    for t, s in type_stats.items():
        print(f"  {t:12s}:        {s['pass']}/{s['total']} pass")
    print(f"{'='*60}\n")

    # Exit with non-zero if any test fails (useful in CI).
    if total_pass < total:
        sys.exit(1)


if __name__ == "__main__":
    run_eval()
