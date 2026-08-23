import { notFound } from "next/navigation";
import Link from "next/link";

import { requireWorkspace } from "@/server/auth/context";
import { getProject } from "@/server/domain/projects";
import { workspaceMembers } from "@/server/domain/dashboard";
import { accentHex } from "@/lib/domain";
import { ProjectHeader } from "@/components/app/project-header";
import { ProjectTabs } from "@/components/app/project-tabs";
import { ItemPanel } from "@/components/app/item-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireWorkspace(slug);
  const project = await getProject(ctx.workspace.id, projectId, {
    role: ctx.role,
    userId: ctx.user.id,
  });
  return { title: project?.name ?? "Proyecto" };
}

/**
 * Marco del proyecto.
 *
 * El encabezado y las pestañas viven en el layout para que moverse entre
 * tareas, contenido e historial no vuelva a montar el contexto ni pierda el
 * scroll. El panel de detalle también, así se puede abrir un elemento desde
 * cualquier pestaña.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireWorkspace(slug);

  const [project, members] = await Promise.all([
    getProject(ctx.workspace.id, projectId, { role: ctx.role, userId: ctx.user.id }),
    workspaceMembers(ctx.workspace.id),
  ]);

  if (!project) notFound();

  const people = members
    .filter((member) => member.role !== "community")
    .map((member) => member.user);

  return (
    <div className="min-w-0">
      {/* Franja de identidad: portada si hay, si no el color del proyecto. */}
      <div
        className="relative h-1 w-full"
        style={{ background: accentHex(project.accent) }}
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-7 lg:px-9">
        {project.ancestors.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1.5 pt-4 text-2xs text-ink-4">
            {project.ancestors.map((ancestor) => (
              <span key={ancestor.id} className="flex items-center gap-1.5">
                <Link
                  href={`/w/${slug}/p/${ancestor.id}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-2"
                >
                  <span
                    className="size-1.5 rounded-[2px]"
                    style={{ background: accentHex(ancestor.accent) }}
                  />
                  {ancestor.name}
                </Link>
                <span className="opacity-50">/</span>
              </span>
            ))}
          </nav>
        )}

        <ProjectHeader
          slug={slug}
          project={project}
          members={people}
          canManage={ctx.can("project.manage")}
          canWrite={ctx.can("content.write")}
        />

        <ProjectTabs
          slug={slug}
          projectId={projectId}
          counts={{
            tasks: project.subtreeRollup.open,
            children: project.children.length,
            files: project._count.attachments,
          }}
          canWork={ctx.can("content.write")}
        />

        <div className="pb-12 pt-5">{children}</div>
      </div>

      <ItemPanel slug={slug} members={people} viewerId={ctx.user.id} />
    </div>
  );
}
