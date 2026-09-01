"use client";

import { createClient } from "@/lib/supabase/client";
import { validarComprovante, montarCaminhoComprovante } from "@/lib/comprovantes";

export async function uploadComprovante(file: File, lancamentoId: string): Promise<string> {
  const erro = validarComprovante(file);
  if (erro) throw new Error(erro);

  const supabase = createClient();
  const path = montarCaminhoComprovante(lancamentoId, file.name, Date.now());

  const { error } = await supabase.storage.from("comprovantes").upload(path, file);
  if (error) throw error;

  return path;
}
