"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { markRead } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";

export function MarkAllRead({ slug, count }: { slug: string; count: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="default"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await markRead(slug);
          router.refresh();
        })
      }
    >
      <CheckCheck className="size-3.5" strokeWidth={2} />
      Marcar {count} como leídas
    </Button>
  );
}
