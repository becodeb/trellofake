/** Marcas diacríticas combinantes (los acentos que quedan tras normalizar). */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Contraseña temporal legible, para cuando un admin da de alta a alguien. */
export function temporaryPassword(): string {
  const words = [
    "hebra", "faro", "brisa", "cedro", "duna", "eco", "flora", "grava",
    "hilo", "isla", "jade", "lago", "marea", "nudo", "ola", "puerto",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(Math.random() * 90) + 10);
  return `${pick()}-${pick()}-${digits}`;
}
