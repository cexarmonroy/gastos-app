"use client";

import Image from "next/image";

export function Navbar() {
  return (
    <header className="h-16 md:h-20 border-b border-border bg-surface flex items-center pl-14 md:pl-8 pr-4 md:pr-8 sticky top-0 z-30">
      <Image
        src="/logo-header.png"
        alt="Colegio Emprender Puente Alto"
        width={2569}
        height={883}
        priority
        className="h-8 md:h-10 w-auto object-contain"
      />
    </header>
  );
}
