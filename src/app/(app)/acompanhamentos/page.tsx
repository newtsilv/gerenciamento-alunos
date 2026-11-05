import { redirect } from "next/navigation";

/** A tela global de acompanhamentos foi removida: tudo começa em Desafios. */
export default function LegacyMonitoringPage() {
  redirect("/desafios");
}
