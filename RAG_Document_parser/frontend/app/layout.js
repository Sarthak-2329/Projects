import "./globals.css";

export const metadata = {
  title: "RAG Document Parser",
  description: "Upload PDFs, ask questions, get grounded answers with citations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <h1>📄 RAG Document Parser</h1>
          <p className="subtitle">Upload · Query · Verify</p>
        </header>
        <main className="app-container">{children}</main>
      </body>
    </html>
  );
}
