"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-xl font-semibold mb-2">Algo deu errado</h1>
      <p className="text-[var(--text-dim)] text-sm mb-6 max-w-md">
        {error.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded"
      >
        Tentar novamente
      </button>
    </div>
  );
}
