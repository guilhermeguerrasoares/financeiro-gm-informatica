"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  Users,
  AlertTriangle,
  Truck,
  BarChart3,
  Landmark,
  LogOut,
  Tags,
  Target,
  KeyRound,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Entradas e Saídas", icon: ArrowLeftRight },
  { href: "/permutas", label: "Permutas", icon: Repeat },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/dividas", label: "Dívidas", icon: AlertTriangle },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/metas", label: "Metas e limites", icon: Target },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="w-64 shrink-0 p-4 hidden md:flex flex-col">
      <div className="glass glow-ring rounded-2xl p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 px-1 mb-6">
          <Image src="/logo.png" alt="GM Stúdio Gamer" width={40} height={27} className="shrink-0" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">GM Stúdio Gamer</p>
            <p className="text-[11px] text-[var(--text-dim)]">Financeiro</p>
          </div>
        </div>

        <ul className="space-y-1 flex-1">
          {NAV.map((item) => {
            const ativo = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    ativo
                      ? "text-[var(--bg)] font-semibold"
                      : "text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]"
                  }`}
                  style={ativo ? { background: "var(--brand-gradient)" } : undefined}
                >
                  <Icon size={16} strokeWidth={2} className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {userEmail && (
          <div className="pt-3 mt-3 border-t border-[var(--border)]">
            <p className="px-3 text-xs text-[var(--text-dim)] truncate mb-1" title={userEmail}>
              {userEmail}
            </p>
            <Link
              href="/senha"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                pathname === "/senha"
                  ? "bg-white/5 text-[var(--text)]"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]"
              }`}
            >
              <KeyRound size={16} strokeWidth={2} className="shrink-0" />
              Alterar senha
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--accent-red)] transition-colors"
              >
                <LogOut size={16} strokeWidth={2} className="shrink-0" />
                Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </nav>
  );
}
