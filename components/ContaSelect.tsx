"use client";

import type { ContaFinanceira } from "@/lib/types";

// Classes completas e literais: o Tailwind varre o código como texto, então
// uma classe montada por interpolação (`bg-[var(--${fundo})]`) nunca chega a
// ser gerada no CSS final.
const FUNDO = {
  surface: "bg-[var(--surface)]",
  "surface-2": "bg-[var(--surface-2)]",
} as const;

// Aparece em todo formulário de baixa (pagamento/recebimento): é aqui que se
// diz de qual conta o dinheiro saiu ou para qual entrou, e é isso que move o
// saldo em /contas e no dashboard. Com uma conta só cadastrada ela já vem
// escolhida, para não obrigar um clique em algo sem alternativa.
export function ContaSelect({
  contas,
  fundo = "surface",
  obrigatoria = true,
}: {
  contas: ContaFinanceira[];
  fundo?: "surface" | "surface-2";
  // Pagamento 100% em permuta não passa por conta nenhuma (é mercadoria
  // entrando no estoque), então exigir uma conta ali só forçaria uma escolha
  // que seria ignorada.
  obrigatoria?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-dim)] mb-1">Conta / caixa</label>
      <select
        name="conta_financeira_id"
        defaultValue={contas.length === 1 ? contas[0].id : ""}
        required={obrigatoria}
        className={`w-full px-3 py-2 rounded border border-[var(--border)] ${FUNDO[fundo]}`}
      >
        <option value="">Selecione</option>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      {contas.length === 0 && (
        <p className="text-xs text-[var(--accent-amber)] mt-1">
          Nenhuma conta cadastrada. Cadastre uma em Contas e caixas para o saldo ser atualizado.
        </p>
      )}
    </div>
  );
}
