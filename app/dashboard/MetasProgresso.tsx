import { money } from "@/lib/format";
import type { ProgressoMeta } from "@/lib/metas-calc";

const COR_STATUS: Record<ProgressoMeta["status"], string> = {
  ok: "var(--brand-cyan)",
  atencao: "var(--accent-amber)",
  estourado: "var(--accent-red)",
  atingida: "var(--accent-green)",
};

function mensagemStatus(status: ProgressoMeta["status"], progresso: number): string | null {
  const pct = Math.round(progresso);
  if (status === "estourado") return `Limite ultrapassado — está em ${pct}% do limite`;
  if (status === "atingida") return `Meta atingida — está em ${pct}% do previsto`;
  if (status === "atencao") return `Perto do limite — está em ${pct}% do limite`;
  return null;
}

export function MetasProgresso({ progressos }: { progressos: ProgressoMeta[] }) {
  if (progressos.length === 0) return null;

  return (
    <div className="glass glow-ring rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">Metas e limites</h2>
      <div className="grid grid-cols-1 gap-5">
        {progressos.map(({ meta, atualValor, atualPercentual, progresso, status }) => {
          const cor = COR_STATUS[status];
          const largura = Math.min(100, Math.max(0, progresso));
          const estourado = status === "estourado";
          // Para métricas em %, o "atual" já é uma fração do faturamento -
          // mostrar junto com o alvo (também em %) como "X de Y" confunde,
          // porque parecem a mesma grandeza quando não são. Por isso o alvo
          // vira uma legenda separada, e o "quanto do alvo já foi usado"
          // fica só na mensagem de status (via `progresso`).
          const atualFormatado =
            meta.unidade === "percentual" ? `${(atualPercentual ?? 0).toFixed(1)}% do faturamento` : money(atualValor);
          const alvoFormatado =
            meta.unidade === "percentual" ? `${meta.valor_alvo}% do faturamento` : money(meta.valor_alvo);
          const mensagem = mensagemStatus(status, progresso);

          return (
            <div
              key={meta.id}
              className={estourado ? "rounded-lg border border-[var(--accent-red)] bg-red-950/20 p-3 -m-3" : undefined}
            >
              <div className="flex justify-between items-baseline text-sm mb-0.5">
                <span className="font-medium">{meta.nome}</span>
                <span className="text-[var(--text-dim)]">{atualFormatado}</span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mb-1.5">
                {meta.tipo === "limite" ? "Limite" : "Meta"}: {alvoFormatado}
              </p>
              <div className="h-3 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${largura}%`, background: cor, boxShadow: `0 0 8px -1px ${cor}` }}
                />
              </div>
              {mensagem && (
                <p className={`text-xs mt-1 ${estourado ? "font-semibold" : ""}`} style={{ color: cor }}>
                  {mensagem}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
