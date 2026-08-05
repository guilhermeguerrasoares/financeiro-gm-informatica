export function Kpi({
  label,
  valor,
  tone = "neutral",
}: {
  label: string;
  valor: string;
  tone?: "neutral" | "red" | "amber" | "green";
}) {
  const color = {
    neutral: "text-[var(--text)]",
    red: "text-[var(--accent-red)]",
    amber: "text-[var(--accent-amber)]",
    green: "text-[var(--accent-green)]",
  }[tone];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="text-xs text-[var(--text-dim)] uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{valor}</div>
    </div>
  );
}
