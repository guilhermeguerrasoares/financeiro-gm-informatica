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
      <div className="flex gap-1 glass rounded-xl p-1">
        <button
          type="button"
          onClick={() => setModo("mes")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            modo === "mes" ? "text-[var(--bg)]" : "text-[var(--text-dim)]"
          }`}
          style={modo === "mes" ? { background: "var(--brand-gradient)" } : undefined}
        >
          Mês
        </button>
        <button
          type="button"
          onClick={() => setModo("personalizado")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            modo === "personalizado" ? "text-[var(--bg)]" : "text-[var(--text-dim)]"
          }`}
          style={modo === "personalizado" ? { background: "var(--brand-gradient)" } : undefined}
        >
          Personalizado
        </button>
      </div>

      {modo === "mes" ? (
        <input
          type="month"
          defaultValue={mesAtual}
          onChange={(e) => e.target.value && router.push(`/dashboard?mes=${e.target.value}`)}
          className="px-3 py-1.5 rounded-lg glass text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]"
        />
      ) : (
        <>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="px-3 py-1.5 rounded-lg glass text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]"
          />
          <span className="text-[var(--text-dim)] text-sm">até</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="px-3 py-1.5 rounded-lg glass text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]"
          />
          <button
            type="button"
            onClick={() => inicio && fim && router.push(`/dashboard?inicio=${inicio}&fim=${fim}`)}
            className="px-3 py-1.5 rounded-lg text-[var(--bg)] text-sm font-semibold"
            style={{ background: "var(--brand-gradient)" }}
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
