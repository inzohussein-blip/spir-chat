"use client";

// Last-resort boundary: catches errors thrown in the root layout itself, so it
// renders its own <html>/<body> and can't rely on providers or the app CSS.
// Kept bilingual and inline-styled to stay robust when everything else fails.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0b12",
          color: "#e5e7eb",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              fontSize: 24,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            }}
          >
            S
          </div>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: "0 0 4px" }}>
            An unexpected error occurred. Please try again.
          </p>
          <p
            style={{ fontSize: "0.9rem", color: "#9ca3af", margin: "0 0 20px" }}
            dir="rtl"
          >
            وقع خطأ غير متوقع. يُرجى المحاولة مرة أخرى.
          </p>
          <button
            onClick={reset}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
            }}
          >
            Try again / إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
