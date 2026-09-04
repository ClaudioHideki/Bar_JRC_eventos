import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Passaporte de Eventos JRC",
  description: "Passaporte digital corporativo de eventos para participantes convidados da JRC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased selection:bg-primary/30">
        {children}
      </body>
    </html>
  );
}
