"use client";

import { useState, useEffect, useCallback } from "react";
import UploadForm from "./components/UploadForm";
import DocumentList from "./components/DocumentList";
import ChatView from "./components/ChatView";

/**
 * Main page — the single-page app shell.
 *
 * Owns two pieces of shared state:
 *   1. `documents` — the list of ingested docs (refreshed after upload)
 *   2. `activeDocumentId` — which doc is scoped for queries (null = all)
 */
export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState(null);

  // Fetch the document list from GET /documents.
  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents`);
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setDocsError(
        err.message.includes("fetch")
          ? "Could not reach the backend. Is the FastAPI server running?"
          : err.message
      );
    } finally {
      setDocsLoading(false);
    }
  }, []);

  // Load documents on mount.
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Called by UploadForm after a successful upload so the list refreshes.
  const handleUploadSuccess = () => {
    fetchDocuments();
  };

  // Toggle the active document scope for queries.
  const handleDocumentClick = (docId) => {
    setActiveDocumentId((prev) => (prev === docId ? null : docId));
  };

  return (
    <>
      {/* --- Upload Section --- */}
      <section className="section">
        <h2 className="section-title">📤 Upload a PDF</h2>
        <UploadForm onUploadSuccess={handleUploadSuccess} />
      </section>

      {/* --- Documents Section --- */}
      <section className="section">
        <h2 className="section-title">📚 Ingested Documents</h2>
        <DocumentList
          documents={documents}
          loading={docsLoading}
          error={docsError}
          activeDocumentId={activeDocumentId}
          onDocumentClick={handleDocumentClick}
        />
      </section>

      {/* --- Chat Section --- */}
      <section className="section">
        <h2 className="section-title">💬 Ask a Question</h2>
        <ChatView activeDocumentId={activeDocumentId} />
      </section>
    </>
  );
}
