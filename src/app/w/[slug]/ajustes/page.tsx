import { notFound } from "next/navigation";

import { requireWorkspace } from "@/server/auth/context";
import { workspaceMembers } from "@/server/domain/dashboard";
import { db } from "@/server/db";
import { Page } from "@/components/app/shell";
import { WorkspaceSettings } from "@/components/app/workspace-settings";
import { MemberList } from "@/components/app/member-list";
import { ApiTokens } from "@/components/app/api-tokens";
import { PageHeader, SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  if (!ctx.can("workspace.manage")) notFound();

  const [members, counts, tokens] = await Promise.all([
    workspaceMembers(ctx.workspace.id),
    Promise.all([
      db.project.count({ where: { workspaceId: ctx.workspace.id } }),
      db.item.count({ where: { workspaceId: ctx.workspace.id } }),
      db.activity.count({ where: { workspaceId: ctx.workspace.id } }),
    ]),
    db.apiToken.findMany({
      where: { workspaceId: ctx.workspace.id },
      select: { id: true, expiresAt: true, revoked: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const [projects, items, events] = counts;

  return (
    <Page>
      <PageHeader
        title="Ajustes"
        description="El nombre del equipo, quién entra y con qué permisos."
      />

      <div className="max-w-2xl space-y-9">
        <section>
          <SectionHeader title="El equipo" />
          <WorkspaceSettings
            slug={slug}
            name={ctx.workspace.name}
            mission={ctx.workspace.mission}
          />
        </section>

        <section>
          <SectionHeader title="Gente" count={members.length} />
          <MemberList slug={slug} members={members} viewerId={ctx.user.id} />
        </section>

        <section>
          <SectionHeader title="Acceso por API" />
          <ApiTokens slug={slug} tokens={tokens} />
        </section>

        <section>
          <SectionHeader title="Qué hay adentro" />
          <div className="grid grid-cols-3 divide-x divide-line-soft overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
            <Figure value={projects} label="Proyectos" />
            <Figure value={items} label="Elementos" />
            <Figure value={events} label="Eventos registrados" />
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-ink-4">
            Nada de esto se borra al terminar un proyecto: se archiva y se puede volver a
            leer, o retomar.
          </p>
        </section>
      </div>
    </Page>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xl font-semibold tabular leading-none tracking-tight text-ink">
        {value}
      </div>
      <div className="mt-1.5 text-2xs text-ink-3">{label}</div>
    </div>
  );
}
