import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer, canViewChallenge } from "@/lib/auth";

export async function authorizeReport(challengeId: string | null) {
  const viewer = await getViewer();
  if (!viewer) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!challengeId || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return { error: NextResponse.json({ error: "Desafio inválido." }, { status: 400 }) };
  }
  if (!canViewChallenge(viewer, challengeId)) {
    return { error: NextResponse.json({ error: "Sem permissão para este desafio." }, { status: 403 }) };
  }
  return { viewer, supabase: await createClient() };
}

export function xlsxResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
