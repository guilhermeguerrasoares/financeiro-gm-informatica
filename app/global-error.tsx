"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ background: "#0B0F14", color: "#E5E7EB" }}>
        <div
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>Algo deu errado</h1>
          <p style={{ color: "#9CA3AF", fontSize: "14px", marginBottom: "24px", maxWidth: "28rem" }}>
            {error.message || "Ocorreu um erro inesperado. Tente novamente."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              background: "#60A5FA",
              color: "#0B0F14",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
