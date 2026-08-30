"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  DEFAULT_FRAMING,
  MAX_ZOOM,
  MIN_ZOOM,
  coverStyle,
  panRange,
  type CoverFraming,
} from "@/lib/cover";
import { setProjectCover } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlays";

/**
 * Acomodar la portada.
 *
 * Se arrastra la imagen dentro del recorte, como cuando se acomoda una foto de
 * perfil. No se recorta el archivo: se guarda qué punto de la imagen tiene que
 * quedar en el centro y cuánto se acerca, así se puede volver a mover mañana
 * sin haber perdido nada.
 *
 * El recorte que se ve acá tiene la proporción real de la franja del proyecto,
 * y al lado se muestra la de la tarjeta —que es más baja— porque el mismo
 * punto tiene que servir para las dos.
 */

/** Proporciones reales de los dos lugares donde se ve una portada. */
const BANNER_RATIO = 1108 / 176;
const CARD_RATIO = 340 / 96;

const ZOOM_STEP = 10;
const KEY_STEP = 2;

export function CoverAdjuster({
  projectId,
  coverUrl,
  framing,
  open,
  onOpenChange,
}: {
  projectId: string;
  coverUrl: string;
  framing: CoverFraming;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const frame = React.useRef<HTMLDivElement>(null);

  const [value, setValue] = React.useState<CoverFraming>(framing);
  const [natural, setNatural] = React.useState({ width: 0, height: 0 });
  const [dragging, setDragging] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Al reabrir el diálogo se parte de lo que está guardado, no de lo que
  // quedó de la última vez que se canceló.
  React.useEffect(() => {
    if (open) setValue(framing);
  }, [open, framing.coverX, framing.coverY, framing.coverZoom]);

  const clampAxis = (n: number) => Math.min(100, Math.max(0, n));

  /**
   * Convierte el arrastre en píxeles a un cambio de encuadre.
   *
   * El signo está invertido a propósito: arrastrar hacia la derecha tiene que
   * mover la imagen hacia la derecha, que es mirar más a la izquierda.
   */
  const nudge = (dx: number, dy: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;

    const range = panRange({
      frameWidth: box.width,
      frameHeight: box.height,
      naturalWidth: natural.width,
      naturalHeight: natural.height,
      zoom: value.coverZoom,
    });

    setValue((current) => ({
      ...current,
      coverX: range.x ? clampAxis(current.coverX - (dx / range.x) * 100) : current.coverX,
      coverY: range.y ? clampAxis(current.coverY - (dy / range.y) * 100) : current.coverY,
    }));
  };

  const clampZoom = (zoom: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));

  /** Valor absoluto: sólo lo usa la barra deslizante. */
  const setZoom = (zoom: number) =>
    setValue((current) => ({ ...current, coverZoom: clampZoom(zoom) }));

  /**
   * Acercar de a pasos. Suma sobre el valor vigente y no sobre el que había
   * cuando se dibujó el botón: si no, seis clics rápidos —o dos vueltas de
   * rueda seguidas— cuentan como uno solo.
   */
  const stepZoom = (delta: number) =>
    setValue((current) => ({ ...current, coverZoom: clampZoom(current.coverZoom + delta) }));

  // La rueda tiene que poder cancelarse para que no scrollee la página
  // detrás del diálogo, y React registra `onWheel` como pasivo.
  React.useEffect(() => {
    const node = frame.current;
    if (!node || !open) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stepZoom(-Math.sign(event.deltaY) * ZOOM_STEP);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [open]);

  const pointer = React.useRef<{ x: number; y: number } | null>(null);

  const save = async () => {
    setSaving(true);
    const result = await setProjectCover(projectId, value);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Portada acomodada");
    onOpenChange(false);
    router.refresh();
  };

  const range = panRange({
    frameWidth: frame.current?.clientWidth ?? 0,
    frameHeight: frame.current?.clientHeight ?? 0,
    naturalWidth: natural.width,
    naturalHeight: natural.height,
    zoom: value.coverZoom,
  });
  const movable = range.x > 1 || range.y > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="lg"
        title="Acomodar la portada"
        description="Arrastrá la imagen para elegir qué parte se ve. La rueda del mouse acerca."
      >
        <DialogBody>
          <div
            ref={frame}
            role="group"
            aria-label="Recorte de la portada"
            tabIndex={0}
            onPointerDown={(event) => {
              if (!movable) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pointer.current = { x: event.clientX, y: event.clientY };
              setDragging(true);
            }}
            onPointerMove={(event) => {
              const last = pointer.current;
              if (!last) return;
              nudge(event.clientX - last.x, event.clientY - last.y);
              pointer.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              pointer.current = null;
              setDragging(false);
            }}
            onPointerCancel={() => {
              pointer.current = null;
              setDragging(false);
            }}
            onKeyDown={(event) => {
              const keys: Record<string, [number, number]> = {
                ArrowLeft: [-KEY_STEP, 0],
                ArrowRight: [KEY_STEP, 0],
                ArrowUp: [0, -KEY_STEP],
                ArrowDown: [0, KEY_STEP],
              };
              const step = keys[event.key];
              if (step) {
                event.preventDefault();
                setValue((current) => ({
                  ...current,
                  coverX: clampAxis(current.coverX + step[0]),
                  coverY: clampAxis(current.coverY + step[1]),
                }));
                return;
              }
              if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                stepZoom(ZOOM_STEP);
              }
              if (event.key === "-") {
                event.preventDefault();
                stepZoom(-ZOOM_STEP);
              }
            }}
            className={cn(
              "relative w-full touch-none select-none overflow-hidden rounded-[var(--r-md)] border border-line bg-surface-2",
              movable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
            )}
            style={{ aspectRatio: String(BANNER_RATIO) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="size-full drag-none"
              style={coverStyle(value)}
            />
          </div>

          <p className="mt-2 text-2xs leading-relaxed text-ink-4">
            {movable
              ? "Arrastrá para mover. Con el recorte enfocado, las flechas lo mueven de a poco y + / − acercan."
              : "La imagen entra justa en el recorte: acercá un poco para poder moverla."}
          </p>

          {/* Acercamiento */}
          <div className="mt-3 flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Alejar"
              disabled={value.coverZoom <= MIN_ZOOM}
              onClick={() => stepZoom(-ZOOM_STEP)}
            >
              <Minus className="size-3.5" strokeWidth={2.2} />
            </Button>

            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={1}
              value={value.coverZoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Acercamiento"
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
            />

            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Acercar"
              disabled={value.coverZoom >= MAX_ZOOM}
              onClick={() => stepZoom(ZOOM_STEP)}
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
            </Button>

            <span className="w-10 text-right text-2xs tabular text-ink-4">
              {value.coverZoom}%
            </span>
          </div>

          {/* La misma decisión, vista donde también se aplica. */}
          <div className="mt-4 flex items-start gap-3">
            <div className="w-32 shrink-0">
              <p className="mb-1 text-2xs uppercase tracking-[0.06em] text-ink-4">
                En la tarjeta
              </p>
              <div
                className="overflow-hidden rounded-[var(--r-sm)] border border-line bg-surface-2"
                style={{ aspectRatio: String(CARD_RATIO) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt=""
                  className="size-full drag-none"
                  style={coverStyle(value)}
                />
              </div>
            </div>

            <p className="pt-4 text-2xs leading-relaxed text-ink-4">
              La tarjeta del listado recorta más bajo que la franja del proyecto. Se guarda
              el punto que elegís, no un recorte, así que sirve para los dos.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            onClick={() => setValue({ ...DEFAULT_FRAMING })}
          >
            <Crosshair className="size-3.5" strokeWidth={1.9} />
            Centrar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
