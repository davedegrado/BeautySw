import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource-variable/jost";
import "./globals.css";
import { ToastProvider } from "@/components/client-ui";

export const metadata: Metadata = {
  title: { default: "Aurea · Beauty Management", template: "%s · Aurea" },
  description: "Il gestionale premium per centri estetici: prenotazioni, clienti, promozioni, eventi e programma fedeltà.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Aurea", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
