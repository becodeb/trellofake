import { deflateSync } from "node:zlib";

/**
 * Generador de PNG mínimo, solo para el seed.
 *
 * Los datos de ejemplo necesitan imágenes de verdad —portadas y capturas— para
 * que la interfaz se vea como se va a ver en uso. Traer una librería de
 * imágenes para eso sería desproporcionado: un PNG sin comprimir es un
 * encabezado, los píxeles y tres CRC.
 */

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export type Painter = (x: number, y: number) => [number, number, number];

export function makePng(width: number, height: number, paint: Painter): Buffer {
  // Cada fila arranca con un byte de filtro (0 = sin filtro).
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      raw[offset++] = clamp(r);
      raw[offset++] = clamp(g);
      raw[offset++] = clamp(b);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color truecolor RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro adaptativo
  ihdr[12] = 0; // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Portada: un degradado diagonal apagado en el color del proyecto, con bandas
 * finas. Sirve para identificar el proyecto de un vistazo sin parecer un
 * banner de plantilla.
 */
export function coverImage(accentHex: string, width = 960, height = 320): Buffer {
  const accent = hexToRgb(accentHex);
  const paper: [number, number, number] = [250, 249, 246];
  const deep = mix(accent, [26, 24, 21], 0.35);

  return makePng(width, height, (x, y) => {
    const diagonal = (x / width) * 0.72 + (y / height) * 0.28;
    const base = mix(mix(paper, accent, 0.16), deep, diagonal * 0.55);

    // Bandas diagonales muy tenues, como una trama de papel.
    const band = Math.sin((x - y * 1.6) * 0.055) * 3.2;
    // Viñeta suave hacia abajo, para que el texto encima respire.
    const vignette = (y / height) * -6;

    return [base[0] + band + vignette, base[1] + band + vignette, base[2] + band + vignette];
  });
}

/**
 * Captura simulada: un mock de interfaz en grises con un bloque de acento.
 * Es lo que alguien pegaría al reportar un problema.
 */
export function screenshotImage(accentHex: string, width = 720, height = 460): Buffer {
  const accent = hexToRgb(accentHex);
  const canvas: [number, number, number] = [244, 242, 237];
  const surface: [number, number, number] = [255, 255, 255];
  const line: [number, number, number] = [225, 221, 213];
  const ink: [number, number, number] = [206, 202, 194];

  const blocks: Array<{ x: number; y: number; w: number; h: number; c: [number, number, number] }> = [
    { x: 0, y: 0, w: width, h: 46, c: surface },
    { x: 0, y: 46, w: width, h: 1, c: line },
    { x: 20, y: 17, w: 96, h: 12, c: ink },
    { x: 0, y: 47, w: 168, h: height - 47, c: surface },
    { x: 168, y: 47, w: 1, h: height - 47, c: line },
    ...Array.from({ length: 6 }, (_, i) => ({
      x: 20,
      y: 74 + i * 26,
      w: 112 - (i % 3) * 18,
      h: 9,
      c: ink,
    })),
    { x: 200, y: 78, w: 240, h: 16, c: ink },
    { x: 200, y: 112, w: width - 240, h: 132, c: surface },
    { x: 216, y: 132, w: 180, h: 10, c: ink },
    { x: 216, y: 152, w: 320, h: 8, c: ink },
    { x: 216, y: 168, w: 268, h: 8, c: ink },
    { x: 216, y: 200, w: 104, h: 26, c: accent },
    { x: 200, y: 268, w: width - 240, h: 132, c: surface },
    { x: 216, y: 288, w: 148, h: 10, c: ink },
    { x: 216, y: 308, w: 300, h: 8, c: ink },
    { x: 216, y: 324, w: 244, h: 8, c: ink },
  ];

  return makePng(width, height, (x, y) => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.c;
    }
    return canvas;
  });
}
