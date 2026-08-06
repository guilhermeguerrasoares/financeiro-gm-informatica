import type { LancamentoRow, Meta, PagamentoRow } from "./types";
import { round2 } from "./calculations";

export type StatusMeta = "ok" | "atencao" | "estourado" | "atingida";

export type ProgressoMeta = {
  meta: Meta;
  atualValor: number;
  atualPercentual: number | null;
  progresso: number;
  status: StatusMeta;
};

function somaFaturamento(lancamentos: LancamentoRow[], pagamentos: PagamentoRow[], inicio: string, fim: string): number {
  const idsReceita = new Set(lancamentos.filter((l) => l.tipo === "receita").map((l) => l.id));
  return round2(
    pagamentos
      .filter((p) => idsReceita.has(p.lancamento_id) && p.data_pagamento >= inicio && p.data_pagamento <= fim)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

function somaPermutas(pagamentos: PagamentoRow[], inicio: string, fim: string): number {
  return round2(
    pagamentos
      .filter((p) => p.forma_pagamento === "permuta" && p.data_pagamento >= inicio && p.data_pagamento <= fim)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

function somaCategoria(
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[],
  categoriaId: string,
  inicio: string,
  fim: string
): number {
  const idsCategoria = new Set(lancamentos.filter((l) => l.categoria_id === categoriaId).map((l) => l.id));
  return round2(
    pagamentos
      .filter((p) => idsCategoria.has(p.lancamento_id) && p.data_pagamento >= inicio && p.data_pagamento <= fim)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

// Progresso é sempre relativo ao faturamento (receita realizada) do mesmo
// período - é o denominador padrão para metas em percentual, inclusive
// quando a métrica em si já é o faturamento.
export function calcularProgressoMetas(
  metas: Meta[],
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[],
  periodo: { inicio: string; fim: string }
): ProgressoMeta[] {
  const faturamento = somaFaturamento(lancamentos, pagamentos, periodo.inicio, periodo.fim);

  return metas
    .filter((m) => m.ativo)
    .map((meta) => {
      let atualValor = 0;
      if (meta.metrica === "faturamento") {
        atualValor = faturamento;
      } else if (meta.metrica === "permutas") {
        atualValor = somaPermutas(pagamentos, periodo.inicio, periodo.fim);
      } else if (meta.metrica === "categoria" && meta.categoria_id) {
        atualValor = somaCategoria(lancamentos, pagamentos, meta.categoria_id, periodo.inicio, periodo.fim);
      }

      const atualPercentual = meta.unidade === "percentual" ? (faturamento > 0 ? round2((atualValor / faturamento) * 100) : 0) : null;
      const base = meta.unidade === "percentual" ? atualPercentual ?? 0 : atualValor;
      const progresso = meta.valor_alvo > 0 ? round2((base / meta.valor_alvo) * 100) : 0;

      let status: StatusMeta;
      if (meta.tipo === "meta") {
        status = progresso >= 100 ? "atingida" : "ok";
      } else {
        status = progresso > 100 ? "estourado" : progresso >= 80 ? "atencao" : "ok";
      }

      return { meta, atualValor, atualPercentual, progresso, status };
    });
}
