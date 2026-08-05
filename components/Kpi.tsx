import type { LucideIcon } from "lucide-react";

export function Kpi({
  label,
  valor,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  valor: string;
  tone?: "neutral" | "red" | "amber" | "green";
  icon?: LucideIcon;
}) {
  const cor = {
    neutral: "var(--brand-cyan)",
    red: "var(--accent-red)",
    amber: "var(--accent-amber)",
    green: "var(--accent-green)",
  }[tone];

  const textoClasse = {
    neutral: "text-[var(--text)]",
    red: "text-[var(--accent-red)]",
    amber: "text-[var(--accent-amber)]",
    green: "text-[var(--accent-green)]",
  }[tone];

  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden" style={{ boxShadow: `0 8px 30px -18px ${cor}` }}>
      <div
        className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: cor }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-semibold mt-1 ${textoClasse}`}>{valor}</div>
        </div>
        {Icon && (
          <div className="shrink-0 p-2 rounded-xl" style={{ background: `${cor}1A`, color: cor }}>
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
