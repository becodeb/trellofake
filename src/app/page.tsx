import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { defaultWorkspaceSlug } from "@/server/auth/context";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const slug = await defaultWorkspaceSlug(user.id);
  redirect(slug ? `/w/${slug}` : "/nuevo-equipo");
}
