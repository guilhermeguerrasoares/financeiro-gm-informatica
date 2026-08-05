export function hoje(): string {
  // en-CA formats as YYYY-MM-DD; pinned to the store's timezone so "hoje" matches
  // the local calendar day instead of drifting a few hours around UTC midnight.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Pure calendar-date arithmetic on a "YYYY-MM-DD" string, anchored at UTC
// noon so it never shifts across a day boundary. Use this (not `new Date()`)
// for any +/- N days math derived from `hoje()`, so date windows stay
// consistent with hoje()'s America/Sao_Paulo "today" instead of drifting
// against the server process's own UTC clock.
export function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(n: number | null | undefined): string {
  return brl.format(n ?? 0);
}

export function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
