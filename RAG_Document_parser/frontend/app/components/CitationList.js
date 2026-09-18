"use client";

import { useState } from "react";

/**
 * CitationList — renders citation items under an answer.
 *
 * This component is the visual proof that the RAG system is "grounded":
 * every numbered reference in the LLM's answer maps back to a specific
 * chunk of source text, identified by filename and page number.
 *
 * DESIGN DECISIONS (commenting these specifically as requested):
 *
 * 1. COLLAPSED BY DEFAULT
 *    Citations are collapsed to keep the chat readable. If every answer
 *    showed 3–5 full chunk texts inline, the conversation would become
 *    unscrollable. The user expands only what they want to verify.
 *
 * 2. HEADER = [N] filename — Page P
 *    The bracketed number [N] matches the reference markers the LLM
 *    places in its answer text (e.g., "Solar energy is growing [1]").
 *    This lets the user visually trace a claim → citation without
 *    reading the full chunk.
 *
 * 3. BODY = THE ACTUAL CHUNK TEXT
 *    This is the raw text that was sent to the LLM as numbered context.
 *    Showing it verbatim (not summarized) is critical — it lets the user
 *    independently verify whether the LLM's answer is actually supported
 *    by the source material, which is the entire point of grounded RAG.
 *
 * Props:
 *   citations — array of { chunk_text, filename, page, chunk_index }
 *               as returned by POST /query
 */
export default function CitationList({ citations }) {
  // Track which citations are expanded by their index.
  // Using an object (not an array) so we don't need to pre-allocate.
  const [expanded, setExpanded] = useState({});

  /**
   * Toggle a specific citation's expanded/collapsed state.
   *
   * We derive the new state from the previous state to avoid
   * race conditions when rapidly clicking multiple citations.
   */
  const toggleCitation = (index) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  if (!citations || citations.length === 0) return null;

  return (
    <div className="citations-container">
      <p className="citations-label">📎 Sources ({citations.length})</p>

      {/*
       * Each citation maps to one numbered context chunk that was
       * provided to the LLM. The index here (i + 1) corresponds to
       * the [1], [2], [3] reference markers in the answer text.
       *
       * The backend's citation parser (parse_citations in query.py)
       * extracts these references from the LLM output, maps them
       * back to 0-based chunk indices, and returns the full metadata.
       * Here, we simply render what the backend provides.
       */}
      {citations.map((citation, i) => {
        const isOpen = expanded[i] || false;

        return (
          <div key={i} className="citation-item">
            {/*
             * CITATION HEADER — always visible.
             * Shows the reference number, filename, and page so the user
             * can identify which source backs a specific claim without
             * needing to expand the full text.
             */}
            <div
              className="citation-header"
              onClick={() => toggleCitation(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggleCitation(i);
              }}
              aria-expanded={isOpen}
            >
              <span className={`citation-toggle ${isOpen ? "open" : ""}`}>
                ▶
              </span>
              <span className="citation-ref">[{i + 1}]</span>
              <span className="citation-source">
                {citation.filename} — Page {citation.page}
              </span>
            </div>

            {/*
             * CITATION BODY — only shown when expanded.
             * Displays the verbatim chunk text that was provided to
             * the LLM as context. This is the "ground truth" the user
             * checks the answer against.
             *
             * Using `white-space: pre-wrap` in CSS to preserve the
             * original formatting of the chunk (paragraph breaks, etc.)
             * since it was extracted directly from the PDF.
             */}
            {isOpen && (
              <div className="citation-body">{citation.chunk_text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
