"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CornerDownLeft, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { addComment, deleteComment } from "@/server/actions/comments";
import { Avatar, type PersonLike } from "@/components/ui/avatar";
import { Button, RowAction } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/field";
import { Kbd, Tooltip } from "@/components/ui/overlays";

export type CommentData = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: PersonLike;
};

/**
 * Conversación.
 *
 * Un hilo plano, ordenado del más viejo al más nuevo, con el compositor
 * pegado abajo. Escribir "@" abre la lista del equipo: mencionar a alguien lo
 * hace aparecer en sus novedades, así que la mención vale como aviso.
 */
export function CommentThread({
  comments,
  members,
  viewerId,
  itemId,
  projectId,
  emptyHint = "Todavía no hay comentarios.",
}: {
  comments: CommentData[];
  members: PersonLike[];
  viewerId: string | null;
  itemId?: string;
  projectId?: string;
  emptyHint?: string;
}) {
  const viewer = viewerId ? members.find((m) => m.id === viewerId) : undefined;

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-xs text-ink-4">{emptyHint}</p>
      ) : (
        <ul className="space-y-3.5">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              members={members}
              canDelete={comment.author.id === viewerId}
            />
          ))}
        </ul>
      )}

      {viewer ? (
        <CommentComposer
          members={members}
          itemId={itemId}
          projectId={projectId}
          viewer={viewer}
        />
      ) : (
        <GuestComposerHint />
      )}
    </div>
  );
}

/** Visitante sin sesión: el hilo se lee, la conversación pide entrar. */
function GuestComposerHint() {
  return (
    <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
      <Link href="/login" className="font-medium text-accent-ink hover:underline">
        Ingresá
      </Link>
      para participar de la conversación.
    </div>
  );
}

function Comment({
  comment,
  members,
  canDelete,
}: {
  comment: CommentData;
  members: PersonLike[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <li className={cn("group flex gap-2.5", pending && "opacity-50")}>
      <Avatar person={comment.author} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{comment.author.name}</span>
          <span className="text-2xs text-ink-4">{relativeTime(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-2xs text-ink-4">· editado</span>}
        </p>
        <div className="prose-note mt-0.5 text-sm">
          <Mentions text={comment.body} members={members} />
        </div>
      </div>

      {canDelete && (
        <Tooltip content="Borrar">
          <RowAction
            aria-label="Borrar comentario"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteComment(comment.id);
                if (!result.ok) toast.error(result.error);
                else router.refresh();
              })
            }
          >
            <Trash2 className="size-3.5" strokeWidth={1.9} />
          </RowAction>
        </Tooltip>
      )}
    </li>
  );
}

/** Resalta las menciones que apuntan a alguien real del equipo. */
function Mentions({ text, members }: { text: string; members: PersonLike[] }) {
  const names = members
    .flatMap((m) => [m.name, m.name.split(" ")[0]])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (names.length === 0 || !text.includes("@")) return <>{text}</>;

  const pattern = new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="font-medium text-accent-ink">
            @{part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function CommentComposer({
  members,
  itemId,
  projectId,
  viewer,
  placeholder = "Escribí un comentario… usá @ para mencionar",
}: {
  members: PersonLike[];
  itemId?: string;
  projectId?: string;
  viewer?: PersonLike;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const candidates =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5);

  const detectMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /@([\p{L}]*)$/u.exec(before);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (person: PersonLike) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@[\p{L}]*$/u, "");
    const after = value.slice(caret);
    const next = `${before}@${person.name.split(" ")[0]} ${after}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => el?.focus());
  };

  const submit = async () => {
    const body = value.trim();
    if (!body || pending) return;

    setPending(true);
    const result = await addComment({ body, itemId, projectId, attachmentIds: [] });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setValue("");
    router.refresh();
  };

  return (
    <div className="relative flex gap-2.5 pt-1">
      {viewer && <Avatar person={viewer} size="sm" className="mt-1.5" />}

      <div className="min-w-0 flex-1">
        <AutoTextarea
          ref={ref}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            detectMention(event.target.value, event.target.selectionStart ?? 0);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
            if (event.key === "Escape") setMentionQuery(null);
          }}
          placeholder={placeholder}
          minRows={2}
        />

        {candidates.length > 0 && (
          <div className="absolute bottom-full left-9 z-20 mb-1 w-56 overflow-hidden rounded-[var(--r-md)] border border-line bg-surface p-1 shadow-[var(--shadow-md)]">
            {candidates.map((person) => (
              <button
                key={person.id}
                onClick={() => insertMention(person)}
                className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Avatar person={person} size="xs" />
                {person.name}
              </button>
            ))}
          </div>
        )}

        {value.trim() && (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-2xs text-ink-4">
              <Kbd>⌘</Kbd>
              <Kbd>
                <CornerDownLeft className="size-2.5" />
              </Kbd>
              para enviar
            </span>
            <Button size="sm" variant="primary" onClick={submit} loading={pending}>
              Comentar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
