import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

/** Mostra um erro legível quando o deploy está sem as variáveis do Supabase (em vez de um 500 genérico). */
function configError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (name) => !process.env[name],
  );
  if (missing.length) return `Variáveis de ambiente ausentes: ${missing.join(", ")}.`;
  if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(url!)) {
    return "NEXT_PUBLIC_SUPABASE_URL aponta para o Supabase local (127.0.0.1). Use a URL do projeto no Supabase Cloud.";
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  const problem = configError();
  if (problem) {
    return new NextResponse(
      `Configuração incompleta do Acompanha.\n\n${problem}\n\nDefina-as em Vercel › Settings › Environment Variables e faça um novo deploy (README, seção 3).`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Verificação otimista (a autorização real acontece no servidor e no RLS)
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isLoggedIn && !isPublic && !path.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
