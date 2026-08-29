"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { restoreProject } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";

/** Retomar un proyecto archivado: vuelve a activo sin perder nada. */
export function RestoreProjectButton({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="xs"
      variant="default"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreProject(projectId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Proyecto retomado", { description: name });
          router.refresh();
        })
      }
    >
      <RotateCcw className="size-3" strokeWidth={2.2} />
      Retomar
    </Button>
  );
}
