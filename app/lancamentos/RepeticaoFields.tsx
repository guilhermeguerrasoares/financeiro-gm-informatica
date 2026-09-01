"use client";

import { useState } from "react";
import { montarOcorrencias, type Frequencia, type ModoValor } from "@/lib/series";
import { money, formatDataBR } from "@/lib/format";

export type Repeticao = "nenhuma" | "parcelada" | "fixa";

// Quantos meses de uma conta fixa o sistema mantém sempre criados à frente.
const MESES_CONTA_FIXA = 12;

export function RepeticaoFields({
  valor,
  vencimento,
  onRepeticaoChange,
}: {
  valor: number;
  vencimento: string;
  onRepeticaoChange: (r: Repeticao) => void;
}) {
  const [repeticao, setRepeticao] = useState<Repeticao>("nenhuma");
  const [frequencia, setFrequencia] = useState<Frequencia>("mensal");
  const [parcelas, setParcelas] = useState(2);
  const [modo, setModo] = useState<ModoValor>("total");

  const previa =
    repeticao === "nenhuma" || !vencimento || valor <= 0
      ? []
      : montarOcorrencias({
          dataInicio: vencimento,
          frequencia: repeticao === "fixa" ? "mensal" : frequencia,
          parcelas: repeticao === "fixa" ? MESES_CONTA_FIXA : Math.max(parcelas, 2),
          valor,
          custo: null,
          modo: repeticao === "fixa" ? "parcela" : modo,
        });

  const ultima = previa[previa.length - 1];

  return (
    <div className="col-span-2 grid grid-cols-2 gap-3">
      <input type="hidden" name="repeticao" value={repeticao} />

      <div className={repeticao === "parcelada" ? "" : "col-span-2"}>
        <label className="block text-xs text-[var(--text-dim)] mb-1">Repetição</label>
        <select
          value={repeticao}
          onChange={(e) => {
            const nova = e.target.value as Repeticao;
            setRepeticao(nova);
            onRepeticaoChange(nova);
          }}
          className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
        >
          <option value="nenhuma">Não se repete</option>
          <option value="parcelada">Parcelado</option>
          <option value="fixa">Fixo mensal</option>
        </select>
      </div>

      {repeticao === "parcelada" && (
        <>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Nº de parcelas</label>
            <input
              type="number"
              min={2}
              name="total_parcelas"
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value) || 2)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Frequência</label>
            <select
              name="frequencia"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as Frequencia)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="mensal">Mensal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">O valor digitado é</label>
            <select
              name="modo_valor"
              value={modo}
              onChange={(e) => setModo(e.target.value as ModoValor)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="total">O total da compra</option>
              <option value="parcela">O valor de cada parcela</option>
            </select>
          </div>
        </>
      )}

      {previa.length > 0 && ultima && (
        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          {repeticao === "fixa"
            ? `Todo dia ${vencimento.slice(8, 10)} — ${MESES_CONTA_FIXA} meses já criados (${formatDataBR(
                previa[0].vencimento
              )} a ${formatDataBR(ultima.vencimento)}), renovando sozinho depois.`
            : `${previa.length} parcelas de ${money(previa[0].valor)}${
                ultima.valor !== previa[0].valor ? ` (a última de ${money(ultima.valor)})` : ""
              } — vencimentos ${previa
                .slice(0, 3)
                .map((o) => formatDataBR(o.vencimento))
                .join(", ")}${previa.length > 3 ? "…" : ""}`}
        </p>
      )}
    </div>
  );
}
