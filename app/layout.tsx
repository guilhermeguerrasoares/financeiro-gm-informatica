import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { CHAVE_TEMA } from "@/lib/tema";

// Roda antes da primeira pintura, direto no <head>: qualquer coisa que só
// decida o tema depois da hidratação faz a tela piscar escura a cada
// carregamento para quem escolheu claro. Por isso a regra do temaInicial()
// aparece repetida aqui - um script pré-hidratação não importa módulo. O
// try/catch é porque localStorage lança em janela privada.
const APLICAR_TEMA = `try{var t=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});document.documentElement.dataset.theme=t==="claro"?"claro":"escuro"}catch(e){}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GM Stúdio Gamer — Financeiro",
  description: "Gestão financeira para loja de informática",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // suppressHydrationWarning: o script acima escreve data-theme no <html>
    // antes da hidratação, então o atributo difere do que o servidor mandou.
    // É a diferença que queremos, não um erro.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APLICAR_TEMA }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen`}>
        <Sidebar userEmail={user?.email ?? null} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
