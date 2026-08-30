"use client";

import { useEffect } from "react";

export default function Error({
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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
        paddingTop: "140px",
        background: "var(--bg-primary)",
        color: "var(--text-secondary)",
      }}
    >
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "var(--text-primary)",
        }}
      >
        Something went wrong
      </h1>
      <p style={{ maxWidth: "44ch" }}>
        An unexpected error occurred while rendering this page.
        {error.digest ? ` (ref: ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1.75rem",
          borderRadius: "var(--border-radius)",
          background: "var(--accent-color)",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        Try Again
      </button>
    </main>
  );
}