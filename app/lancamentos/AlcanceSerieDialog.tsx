"use client";

const OPCOES = [
  { valor: "este" as const, rotulo: "Só este lançamento" },
  { valor: "proximos" as const, rotulo: "Este e os próximos da série" },
  { valor: "todos" as const, rotulo: "Toda a série" },
];

export function AlcanceSerieDialog({
  acao,
  onEscolher,
  onCancelar,
}: {
  acao: "editar" | "excluir";
  onEscolher: (alcance: "este" | "proximos" | "todos") => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={acao === "editar" ? "Alcance da edição" : "Alcance da exclusão"}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <p className="text-sm font-semibold mb-1">Este lançamento faz parte de uma série.</p>
        <p className="text-xs text-[var(--text-dim)] mb-4">
          {acao === "editar" ? "Aplicar a alteração a:" : "Excluir:"} lançamentos já pagos não são
          afetados.
        </p>

        <div className="grid gap-2">
          {OPCOES.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => onEscolher(o.valor)}
              className="w-full px-3 py-2 text-left text-sm rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className="mt-3 w-full px-3 py-2 text-sm text-[var(--text-dim)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
