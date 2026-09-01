import { round2 } from "./calculations";
import { ultimoDiaDoMes } from "./format";

export type Frequencia = "semanal" | "quinzenal" | "mensal";
export type TipoSerie = "parcelada" | "fixa";
export type ModoValor = "total" | "parcela";

export type Ocorrencia = {
  parcela_numero: number;
  vencimento: string;
  valor: number;
  custo: number | null;
};

// Horizonte padrão de uma conta fixa: um ano à frente. Ver o spec, seção 5.
const HORIZONTE_MESES_PADRAO = 12;

// Trava de segurança do laço de reabastecimento. Nenhuma frequência real
// chega perto disso; existe só para uma regra corrompida não travar a tela.
const MAX_OCORRENCIAS = 1000;

// Soma meses a uma data "YYYY-MM-DD" grudando no último dia do mês de
// destino quando o dia não existe lá (31 de janeiro + 1 mês = 28/29 de
// fevereiro).
function addMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const indiceMes = ano * 12 + (mes - 1) + meses;
  const mesAlvo = `${Math.floor(indiceMes / 12)}-${String((indiceMes % 12) + 1).padStart(2, "0")}`;
  const ultimoDia = Number(ultimoDiaDoMes(mesAlvo).slice(8, 10));
  return `${mesAlvo}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

// Sempre calculada a partir de `dataInicio`, nunca da ocorrência anterior.
// Encadear a partir da anterior faria uma série que começa em 31/jan travar
// em "dia 28" para sempre, depois de passar por fevereiro.
export function proximaData(dataInicio: string, frequencia: Frequencia, ordinal: number): string {
  if (frequencia === "mensal") return addMeses(dataInicio, ordinal);
  const dias = frequencia === "semanal" ? 7 : 14;
  const d = new Date(`${dataInicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias * ordinal);
  return d.toISOString().slice(0, 10);
}

// A última parcela absorve a sobra de centavos, para a soma bater com o
// total exatamente. R$ 1.000 em 3x = 333,33 + 333,33 + 333,34.
export function dividirValor(total: number, parcelas: number): number[] {
  const base = round2(total / parcelas);
  const valores = Array.from({ length: parcelas }, () => base);
  valores[parcelas - 1] = round2(total - round2(base * (parcelas - 1)));
  return valores;
}

export function valoresDaSerie(valor: number, parcelas: number, modo: ModoValor): number[] {
  return modo === "total"
    ? dividirValor(valor, parcelas)
    : Array.from({ length: parcelas }, () => round2(valor));
}

export function montarOcorrencias({
  dataInicio,
  frequencia,
  parcelas,
  valor,
  custo,
  modo,
}: {
  dataInicio: string;
  frequencia: Frequencia;
  parcelas: number;
  valor: number;
  custo: number | null;
  modo: ModoValor;
}): Ocorrencia[] {
  const valores = valoresDaSerie(valor, parcelas, modo);
  // O custo segue o mesmo modo do valor: rateado quando o usuário informou o
  // total, repetido quando informou o de cada parcela. É o que mantém a
  // margem do DRE correta em cada mês, em vez de concentrar o CMV no primeiro.
  const custos = custo === null ? null : valoresDaSerie(custo, parcelas, modo);

  return valores.map((v, i) => ({
    parcela_numero: i + 1,
    vencimento: proximaData(dataInicio, frequencia, i),
    valor: v,
    custo: custos ? custos[i] : null,
  }));
}

// Só acrescenta ocorrências DEPOIS da última existente. Preencher buracos no
// meio recriaria justamente as parcelas que o usuário apagou à mão.
export function ocorrenciasFaltantes({
  dataInicio,
  frequencia,
  ultimoOrdinal,
  hoje,
  horizonteMeses = HORIZONTE_MESES_PADRAO,
}: {
  dataInicio: string;
  frequencia: Frequencia;
  ultimoOrdinal: number;
  hoje: string;
  horizonteMeses?: number;
}): { parcela_numero: number; vencimento: string }[] {
  const limite = addMeses(hoje, horizonteMeses);
  const faltantes: { parcela_numero: number; vencimento: string }[] = [];

  for (let ordinal = ultimoOrdinal + 1; faltantes.length < MAX_OCORRENCIAS; ordinal++) {
    const vencimento = proximaData(dataInicio, frequencia, ordinal);
    if (vencimento > limite) break;
    // Série que ficou sem nenhum lançamento recomeça de hoje: repovoar o
    // passado criaria contas vencidas que ninguém pediu.
    if (ultimoOrdinal < 0 && vencimento < hoje) continue;
    faltantes.push({ parcela_numero: ordinal + 1, vencimento });
  }

  return faltantes;
}
