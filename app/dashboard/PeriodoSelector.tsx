"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PeriodoSelector({
  mesAtual,
  inicioAtual,
  fimAtual,
  modoAtual,
}: {
  mesAtual: string;
  inicioAtual: string;
  fimAtual: string;
  modoAtual: "mes" | "personalizado";
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"mes" | "personalizado">(modoAtual);
  const [inicio, setInicio] = useState(inicioAtual);
  const [fim, setFim] = useState(fimAtual);

  return (
    <div className="flex flex-wrap items-end gap-2 mb-4">
      <div className="flex gap-1 border border-[var(--border)] rounded p-0.5">
        <button
          type="button"
          onClick={() => setModo("mes")}
          className={`px-3 py-1 text-xs font-semibold rounded ${
            modo === "mes" ? "bg-[var(--accent-blue)] text-[var(--bg)]" : "text-[var(--text-dim)]"
          }`}
        >
          Mês
        </button>
        <button
          type="button"
          onClick={() => setModo("personalizado")}
          className={`px-3 py-1 text-xs font-semibold rounded ${
            modo === "personalizado" ? "bg-[var(--accent-blue)] text-[var(--bg)]" : "text-[var(--text-dim)]"
          }`}
        >
          Personalizado
        </button>
      </div>

      {modo === "mes" ? (
        <input
          type="month"
          defaultValue={mesAtual}
          onChange={(e) => e.target.value && router.push(`/dashboard?mes=${e.target.value}`)}
          className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
      ) : (
        <>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
          />
          <span className="text-[var(--text-dim)] text-sm">até</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
          />
          <button
            type="button"
            onClick={() => inicio && fim && router.push(`/dashboard?inicio=${inicio}&fim=${fim}`)}
            className="px-3 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
          >
            Aplicar
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="ml-auto px-3 py-1.5 text-xs text-[var(--text-dim)] underline"
      >
        Voltar para hoje
      </button>
    </div>
  );
}
