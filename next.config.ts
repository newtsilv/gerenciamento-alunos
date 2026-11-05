import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas as páginas dependem da sessão do usuário (cookies do Supabase),
  // então usamos o modelo de renderização dinâmica tradicional.
  cacheComponents: false,
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
