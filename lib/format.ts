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

// Whole days between two "YYYY-MM-DD" strings (fim - inicio), UTC-noon
// anchored for the same reason as addDias.
export function diffDias(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T12:00:00Z`);
  const b = new Date(`${fim}T12:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// Last calendar day of a "YYYY-MM" month string.
export function ultimoDiaDoMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  const primeiroDiaProximoMes =
    mesNum === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mesNum + 1).padStart(2, "0")}-01`;
  return addDias(primeiroDiaProximoMes, -1);
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
