import { redirect } from "next/navigation";

/**
 * Ruta vieja de "Cómo conectarse". La pestaña se renombró a "Recursos" y se
 * mudó a `/recursos` (T5); esto queda para que un marcador o un cliente MCP
 * viejo no se rompa.
 */
export default async function LegacyIntegrationRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/p/${projectId}/recursos`);
}
