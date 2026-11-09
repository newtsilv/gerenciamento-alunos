import { RouteSkeleton } from "@/components/shared/page-skeleton";

/** Mantém o cabeçalho e as abas do desafio enquanto o conteúdo da aba carrega. */
export default function Loading() {
  return <RouteSkeleton insideChallenge />;
}
