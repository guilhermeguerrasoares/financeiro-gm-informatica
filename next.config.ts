import type { NextConfig } from "next";

const emDesenvolvimento = process.env.NODE_ENV === "development";
const supabaseOrigem = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// CSP sem nonce, de propósito. O App Router injeta scripts inline de
// hidratação; um CSP com nonce exigiria gerar e propagar o nonce pelo
// middleware, que hoje só cuida de sessão. Mesmo com 'unsafe-inline', a
// política já barra o que interessa aqui: carregar script de origem externa e
// mandar dado para fora (connect-src). Trocar por nonce é evolução possível,
// não pré-requisito.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // O HMR do next dev usa eval e um websocket; em produção nenhum dos dois entra.
  emDesenvolvimento
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  emDesenvolvimento
    ? `connect-src 'self' ${supabaseOrigem} ws://localhost:* http://localhost:*`
    : `connect-src 'self' ${supabaseOrigem}`,
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
