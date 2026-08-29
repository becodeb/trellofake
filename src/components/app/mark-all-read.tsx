"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { markRead } from "@/server/actions/team";
import { Button } from "@/components/ui/button";

export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="default"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await markRead();
          router.refresh();
        })
      }
    >
      <CheckCheck className="size-3.5" strokeWidth={2} />
      Marcar {count} como leídas
    </Button>
  );
}
