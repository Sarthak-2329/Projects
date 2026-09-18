"use client";

import { useState, useRef, useEffect } from "react";
import CitationList from "./CitationList";

/**
 * Detect "I don't know" responses from the LLM.
 *
 * The backend prompt instructs the LLM to say
 * "I don't know based on the provided context." when context is
 * insufficient. We check for this (case-insensitive) to render
 * the answer with a distinct visual treatment.
 */
function isIDontKnowAnswer(answer) {
  const lower = answer.toLowerCase();
  return (
    lower.includes("i don't know") ||
    lower.includes("i do not know") ||
    lower.includes("cannot answer") ||
    lower.includes("not enough context") ||
    lower.includes("no relevant information")
  );
}

/**
 * ChatView — question input + scrollable Q&A message list.
 *
 * Props:
 *   activeDocumentId — which doc to scope the query to (null = all)
 */
export default function ChatView({ activeDocumentId }) {
  // Each message: { type: "question"|"answer"|"error", text, citations?, isIDK? }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when new messages arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // Add the user's question to the message list immediately.
    setMessages((prev) => [...prev, { type: "question", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const body = { question };
      if (activeDocumentId) {
        body.document_id = activeDocumentId;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Query failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      const idk = isIDontKnowAnswer(data.answer);

      setMessages((prev) => [
        ...prev,
        {
          type: "answer",
          text: data.answer,
          citations: data.citations || [],
          isIDK: idk,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          text: err.message.includes("fetch")
            ? "Could not reach the backend. Is the FastAPI server running?"
            : err.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Scrollable message list */}
      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <p className="chat-empty-state">
            Ask a question about your uploaded documents.
          </p>
        )}

        {messages.map((msg, idx) => {
          if (msg.type === "question") {
            return (
              <div key={idx} className="chat-pair">
                <div className="chat-question">{msg.text}</div>
              </div>
            );
          }

          if (msg.type === "error") {
            return (
              <div key={idx} className="chat-answer chat-error">
                ⚠️ {msg.text}
              </div>
            );
          }

          // msg.type === "answer"
          return (
            <div key={idx} className={`chat-answer ${msg.isIDK ? "idk" : ""}`}>
              {msg.isIDK && <span className="idk-icon">🤷</span>}
              {msg.text}

              {/* Citations are only shown for real answers, not IDK responses */}
              {!msg.isIDK && msg.citations && msg.citations.length > 0 && (
                <CitationList citations={msg.citations} />
              )}
            </div>
          );
        })}

        {/* Thinking indicator while waiting for the backend */}
        {loading && (
          <div className="thinking-indicator">🧠 Thinking…</div>
        )}

        {/* Invisible anchor to auto-scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          type="text"
          placeholder={
            activeDocumentId
              ? `Ask about ${activeDocumentId}…`
              : "Ask about your documents…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          type="submit"
          disabled={loading || !input.trim()}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
