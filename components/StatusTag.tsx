import type { StatusLancamento } from "@/lib/calculations";

const LABEL: Record<StatusLancamento, string> = {
  atrasado: "Atrasada",
  aberto: "Em aberto",
  parcial: "Parcial",
  quitado: "Quitada",
};

const COLOR: Record<StatusLancamento, string> = {
  atrasado: "bg-[var(--tag-vermelho-bg)] text-[var(--accent-red)]",
  aberto: "bg-[var(--tag-azul-bg)] text-[var(--accent-blue)]",
  parcial: "bg-[var(--tag-ambar-bg)] text-[var(--accent-amber)]",
  quitado: "bg-[var(--tag-verde-bg)] text-[var(--accent-green)]",
};

export function StatusTag({ status }: { status: StatusLancamento }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${COLOR[status]}`}>
      {LABEL[status]}
    </span>
  );
}
