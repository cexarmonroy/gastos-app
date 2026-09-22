import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-headline",
});

export const metadata: Metadata = {
  title: "Sistema de Gestión | Premium",
  description: "Administración avanzada de registros",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

import AuthProvider from "@/components/providers/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} ${plusJakartaSans.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <main className="min-h-screen flex flex-col relative overflow-hidden">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
