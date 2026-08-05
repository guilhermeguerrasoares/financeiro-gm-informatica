import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loja de Informática — Financeiro",
  description: "Gestão financeira para loja de informática",
};

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lancamentos", label: "Entradas e Saídas" },
  { href: "/permutas", label: "Permutas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/dividas", label: "Dívidas" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/contas", label: "Contas" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen`}>
        <nav className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 hidden md:block">
          <p className="text-sm font-semibold mb-4">Loja de Informática</p>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-2 py-1.5 rounded text-sm text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
