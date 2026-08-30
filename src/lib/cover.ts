import type * as React from "react";

/**
 * Encuadre de la portada de un proyecto.
 *
 * No recortamos la imagen: guardamos dónde mirarla. Eso deja volver a
 * acomodarla cuantas veces haga falta sin perder calidad, y hace que la misma
 * foto funcione en la franja ancha del proyecto y en la tarjeta —que es mucho
 * más baja— sin subir dos versiones.
 *
 * Pura aritmética y estilos: la importan el servidor (para pintar) y el
 * acomodador (que es cliente), así que las dos puntas encuadran igual.
 */

export type CoverFraming = {
  /** Punto de interés horizontal, 0 (izquierda) a 100 (derecha). */
  coverX: number;
  /** Punto de interés vertical, 0 (arriba) a 100 (abajo). */
  coverY: number;
  /** Acercamiento en porcentaje. 100 = la imagen entra justa en el recorte. */
  coverZoom: number;
};

export const DEFAULT_FRAMING: CoverFraming = {
  coverX: 50,
  coverY: 50,
  coverZoom: 100,
};

export const MIN_ZOOM = 100;
export const MAX_ZOOM = 300;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Redondea y encierra en rango. Nada llega a la base fuera de estos límites. */
export function normalizeFraming(input: Partial<CoverFraming>): CoverFraming {
  return {
    coverX: clamp(Math.round(input.coverX ?? 50), 0, 100),
    coverY: clamp(Math.round(input.coverY ?? 50), 0, 100),
    coverZoom: clamp(Math.round(input.coverZoom ?? 100), MIN_ZOOM, MAX_ZOOM),
  };
}

/**
 * El estilo de la imagen de portada.
 *
 * `object-position` elige qué parte se ve del recorte que hace `object-fit:
 * cover`, y `transform: scale` acerca. El truco está en que el origen de la
 * escala sea el mismo punto: así acercarse no mueve lo que estabas mirando, y
 * arrastrar corre la imagen aunque ya no sobre nada por ese eje.
 *
 * Con los valores por defecto (50, 50, 100) esto es exactamente un
 * `object-cover` centrado: las portadas viejas se ven igual que siempre.
 */
export function coverStyle(framing: Partial<CoverFraming>): React.CSSProperties {
  const { coverX, coverY, coverZoom } = normalizeFraming(framing);
  const position = `${coverX}% ${coverY}%`;

  return {
    objectFit: "cover",
    objectPosition: position,
    ...(coverZoom === 100
      ? {}
      : { transform: `scale(${coverZoom / 100})`, transformOrigin: position }),
  };
}

/**
 * Cuántos píxeles de imagen se pueden correr en cada eje con este encuadre.
 *
 * Es lo que convierte el arrastre del mouse en un cambio de porcentaje: sin
 * esto, mover el mouse 10 px correría la imagen una distancia distinta según
 * el tamaño de la foto. Si por un eje no sobra nada (una imagen justa, sin
 * acercar), el resultado es 0 y por ahí no se arrastra: no hay para dónde.
 */
export function panRange({
  frameWidth,
  frameHeight,
  naturalWidth,
  naturalHeight,
  zoom,
}: {
  frameWidth: number;
  frameHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
}): { x: number; y: number } {
  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) {
    return { x: 0, y: 0 };
  }

  // La escala que aplica `object-fit: cover` antes de nuestro acercamiento.
  const cover = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const scale = cover * (zoom / 100);

  return {
    x: Math.max(naturalWidth * scale - frameWidth, 0),
    y: Math.max(naturalHeight * scale - frameHeight, 0),
  };
}
