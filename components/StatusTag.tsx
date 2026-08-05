import type { StatusLancamento } from "@/lib/calculations";

const LABEL: Record<StatusLancamento, string> = {
  atrasado: "Atrasada",
  aberto: "Em aberto",
  parcial: "Parcial",
  quitado: "Quitada",
};

const COLOR: Record<StatusLancamento, string> = {
  atrasado: "bg-red-950 text-[var(--accent-red)]",
  aberto: "bg-blue-950 text-[var(--accent-blue)]",
  parcial: "bg-amber-950 text-[var(--accent-amber)]",
  quitado: "bg-emerald-950 text-[var(--accent-green)]",
};

export function StatusTag({ status }: { status: StatusLancamento }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${COLOR[status]}`}>
      {LABEL[status]}
    </span>
  );
}
