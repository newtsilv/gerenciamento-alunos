import { redirect } from "next/navigation";

/** Endereço antigo: a escolha do dia agora é a página inicial do desafio. */
export default async function LegacySessionsPage({ params }: PageProps<"/desafios/[id]/acompanhamentos">) {
  const { id } = await params;
  redirect(`/desafios/${id}`);
}
