"use client";

import { createClient } from "@/lib/supabase/client";

export async function uploadComprovante(file: File, lancamentoId: string): Promise<string> {
  const supabase = createClient();
  const path = `${lancamentoId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from("comprovantes").upload(path, file);
  if (error) throw error;

  return path;
}
