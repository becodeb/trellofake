import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/overlays";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * La serif aparece en muy pocos lugares — el logotipo, los saludos del
 * dashboard, los estados vacíos — y es lo que le saca a la interfaz el aire de
 * plantilla. Todo lo demás es Inter.
 */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hilo",
    template: "%s · Hilo",
  },
  description:
    "El hilo de tu equipo: qué está activo, qué cambió, qué falta y qué se decidió.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          El tema se aplica antes del primer pintado para que nadie vea un
          destello blanco al entrar de noche.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("hilo-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(!t&&d))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${display.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          gap={8}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex items-center gap-2.5 w-full rounded-[var(--r-md)] border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-[var(--shadow-md)]",
              title: "font-medium",
              description: "text-ink-3 text-xs",
              error: "border-[var(--tone-blocked)]/30",
            },
          }}
        />
      </body>
    </html>
  );
}
