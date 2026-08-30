import Link from "next/link";

export default function NotFound() {
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
          fontSize: "5rem",
          fontWeight: 800,
          lineHeight: 1,
          color: "var(--accent-color)",
          margin: 0,
        }}
      >
        404
      </h1>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
        Lost your way?
      </h2>
      <p style={{ maxWidth: "44ch" }}>
        Sorry, we can&apos;t find that page. You&apos;ll find plenty to explore on the home page.
      </p>
      <Link
        href="/"
        style={{
          marginTop: "0.75rem",
          display: "inline-block",
          padding: "0.75rem 1.75rem",
          borderRadius: "var(--border-radius)",
          background: "var(--accent-color)",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        Go Home
      </Link>
    </main>
  );
}