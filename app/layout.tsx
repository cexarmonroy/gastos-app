import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Tesorería CGPA",
    template: "%s · Tesorería CGPA",
  },
  description: "Tesorería del Centro General de Padres y Apoderados",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

import AuthProvider from "@/components/providers/AuthProvider";
import { Toaster } from "@/components/ui/Toaster";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <main className="min-h-screen flex flex-col relative overflow-hidden">
            {children}
          </main>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
