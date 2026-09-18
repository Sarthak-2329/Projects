"use client";

/**
 * DocumentList — shows all ingested documents from GET /documents.
 *
 * Props:
 *   documents          — array of { document_id, chunk_count }
 *   loading            — boolean, true while fetching
 *   error              — string or null
 *   activeDocumentId   — the currently-selected doc (or null for "all")
 *   onDocumentClick(id) — toggle the active document scope
 */
export default function DocumentList({
  documents,
  loading,
  error,
  activeDocumentId,
  onDocumentClick,
}) {
  if (loading) {
    return <p className="status-message loading">Loading documents…</p>;
  }

  if (error) {
    return <p className="status-message error">{error}</p>;
  }

  if (documents.length === 0) {
    return <p className="empty-state">No documents ingested yet. Upload a PDF above to get started.</p>;
  }

  return (
    <div>
      <div className="documents-grid">
        {documents.map((doc) => (
          <div
            key={doc.document_id}
            className={`doc-card ${activeDocumentId === doc.document_id ? "active" : ""}`}
            onClick={() => onDocumentClick(doc.document_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onDocumentClick(doc.document_id);
            }}
          >
            <span className="doc-name">
              📄 {doc.document_id}
            </span>
            <span className="chunk-badge">
              {doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </div>

      <p className="active-scope-label">
        {activeDocumentId
          ? `Querying: ${activeDocumentId} (click again to query all)`
          : "Querying: all documents (click one to narrow scope)"}
      </p>
    </div>
  );
}
