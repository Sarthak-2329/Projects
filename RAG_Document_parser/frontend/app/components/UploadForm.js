"use client";

import { useState, useRef } from "react";

/**
 * UploadForm — PDF upload with loading state and success/error feedback.
 *
 * Props:
 *   onUploadSuccess() — called after a successful upload so the parent
 *                        can refresh the document list.
 */
export default function UploadForm({ onUploadSuccess }) {
  const [status, setStatus] = useState(null); // { type, message }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];

    if (!file) {
      setStatus({ type: "error", message: "Please select a PDF file." });
      return;
    }

    if (!file.name.endsWith(".pdf")) {
      setStatus({ type: "error", message: "Only PDF files are supported." });
      return;
    }

    setUploading(true);
    setStatus({ type: "loading", message: "Uploading and processing…" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setStatus({
        type: "success",
        message: `✓ Uploaded "${data.document_id}" — ${data.chunks_created} chunks created`,
      });

      // Reset the file input so the same file can be re-uploaded if needed.
      fileInputRef.current.value = "";

      // Tell the parent to refresh the document list.
      onUploadSuccess?.();
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message.includes("fetch")
          ? "Could not reach the backend. Is the FastAPI server running?"
          : err.message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <form className="upload-form" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          disabled={uploading}
        />
        <button className="upload-btn" type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {status && (
        <div className={`status-message ${status.type}`}>{status.message}</div>
      )}
    </div>
  );
}
