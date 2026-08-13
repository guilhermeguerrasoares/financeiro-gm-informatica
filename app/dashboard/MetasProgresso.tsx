import { money } from "@/lib/format";
import type { ProgressoMeta } from "@/lib/metas-calc";

const COR_STATUS: Record<ProgressoMeta["status"], string> = {
  ok: "var(--brand-cyan)",
  atencao: "var(--accent-amber)",
  estourado: "var(--accent-red)",
  atingida: "var(--accent-green)",
};

function mensagemStatus(p: ProgressoMeta): string | null {
  const { meta, status, progresso, atualPercentual } = p;

  // Para metas em %, "progresso" é uma razão entre duas percentagens (ex:
  // 100% do faturamento sobre um limite de 15% = 667%) - confuso de ler.
  // Aqui mostramos as duas percentagens direto, sem essa conta em cima.
  if (meta.unidade === "percentual") {
    const atual = (atualPercentual ?? 0).toFixed(1);
    const alvo = meta.valor_alvo;
    if (status === "estourado") return `Limite ultrapassado — está em ${atual}% do faturamento (limite: ${alvo}%)`;
    if (status === "atingida") return `Meta atingida — está em ${atual}% do faturamento (meta: ${alvo}%)`;
    if (status === "atencao") return `Perto do limite — está em ${atual}% do faturamento (limite: ${alvo}%)`;
    return null;
  }

  const pct = Math.round(progresso);
  if (status === "estourado") return `Limite ultrapassado — está em ${pct}% do limite`;
  if (status === "atingida") return `Meta atingida — está em ${pct}% do previsto`;
  if (status === "atencao") return `Perto do limite — está em ${pct}% do limite`;
  return null;
}

export function MetasProgresso({ progressos }: { progressos: ProgressoMeta[] }) {
  if (progressos.length === 0) return null;

  // `faturamento` é o mesmo em todo item da lista (é o total do período,
  // não algo por meta) - mostrado uma vez no cabeçalho em vez de repetido
  // em cada meta percentual.
  const faturamentoPeriodo = progressos[0].faturamento;
  const temMetaPercentual = progressos.some((p) => p.meta.unidade === "percentual");

  return (
    <div className="glass glow-ring rounded-2xl p-5 mb-6">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">Metas e limites</h2>
        {temMetaPercentual && (
          <span className="text-xs text-[var(--text-dim)]">Faturamento do período: {money(faturamentoPeriodo)}</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5">
        {progressos.map((p) => {
          const { meta, atualValor, atualPercentual, progresso, status } = p;
          const cor = COR_STATUS[status];
          const estourado = status === "estourado";
          const mensagem = mensagemStatus(p);

          return (
            <div
              key={meta.id}
              className={estourado ? "rounded-lg border border-[var(--accent-red)] bg-red-950/20 p-3 -m-3" : undefined}
            >
              <div className="flex justify-between items-baseline text-sm mb-1.5">
                <span className="font-medium">{meta.nome}</span>
                <span className="text-[var(--text-dim)]">
                  {meta.unidade === "percentual" ? `${(atualPercentual ?? 0).toFixed(1)}% do faturamento` : money(atualValor)}
                </span>
              </div>

              {meta.unidade === "percentual" ? (
                <>
                  <div className="relative h-4 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, atualPercentual ?? 0))}%`,
                        background: cor,
                        boxShadow: `0 0 8px -1px ${cor}`,
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-white/80"
                      style={{ left: `${Math.min(100, Math.max(0, meta.valor_alvo))}%` }}
                      title={`${meta.tipo === "limite" ? "Limite" : "Meta"}: ${meta.valor_alvo}%`}
                    />
                  </div>
                  <div className="flex justify-end text-[10px] text-[var(--text-dim)] mt-1">
                    <span>
                      {meta.tipo === "limite" ? "Limite" : "Meta"}: {meta.valor_alvo}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-3 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, progresso))}%`,
                      background: cor,
                      boxShadow: `0 0 8px -1px ${cor}`,
                    }}
                  />
                </div>
              )}

              {meta.unidade !== "percentual" && (
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {meta.tipo === "limite" ? "Limite" : "Meta"}: {money(meta.valor_alvo)}
                </p>
              )}

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
