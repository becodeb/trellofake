import { requireWorkspace } from "@/server/auth/context";
import { db } from "@/server/db";
import { ROLE_LABEL, type WorkspaceRole } from "@/lib/domain";
import { longDate } from "@/lib/format";
import { Page } from "@/components/app/shell";
import { ProfileForm } from "@/components/app/profile-form";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const membership = await db.membership.findUniqueOrThrow({
    where: { userId_workspaceId: { userId: ctx.user.id, workspaceId: ctx.workspace.id } },
    select: { joinedAt: true, title: true },
  });

  return (
    <Page>
      <PageHeader title="Mi perfil" />

      <div className="max-w-xl space-y-8">
        <div className="flex items-center gap-4 rounded-[var(--r-lg)] border border-line bg-surface p-4">
          <Avatar person={ctx.user} size="xl" />
          <div className="min-w-0">
            <p className="text-md font-semibold text-ink">{ctx.user.name}</p>
            <p className="text-xs text-ink-3">{ctx.user.email}</p>
            <p className="mt-1 text-2xs text-ink-4">
              {ROLE_LABEL[ctx.role as WorkspaceRole] ?? ctx.role} en {ctx.workspace.name}
              {membership.title && ` · ${membership.title}`}
              {` · desde el ${longDate(membership.joinedAt)}`}
            </p>
          </div>
        </div>

        <section>
          <SectionHeader title="Tus datos" />
          <ProfileForm name={ctx.user.name} avatarUrl={ctx.user.avatarUrl} />
        </section>
      </div>
    </Page>
  );
}
