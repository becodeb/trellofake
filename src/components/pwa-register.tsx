"use client";

import * as React from "react";

/**
 * Registra el service worker, solo en producción.
 *
 * En desarrollo un service worker cacheado es puro dolor de cabeza (hay que
 * acordarse de desregistrarlo cada vez que algo "no se actualiza"), así que ni
 * se intenta: `next dev` nunca lo ve.
 */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la app sigue andando igual, solo que no queda
      // instalable ni tiene página de "sin conexión": no hace falta avisar.
    });
  }, []);

  return null;
}
