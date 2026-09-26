// Genera los íconos de la extensión a partir del ícono PWA existente
// (public/icons/icon-512.png), en los tamaños que pide manifest.json.
// Uso: node scripts/make-extension-icons.mjs (o `npm run ext:icons`).
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "public/icons/icon-512.png");
const outDir = path.join(root, "extension/icons");

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const target = path.join(outDir, `icon${size}.png`);
  await sharp(source).resize(size, size).png().toFile(target);
  console.log(`wrote ${path.relative(root, target)}`);
}
