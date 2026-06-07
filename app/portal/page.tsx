import { getPublicProjectsSummary, getPublicTreasurySummary } from "@/app/actions/public-portal";
import { isPublicPortalEnabled } from "@/lib/public-portal";
import { PublicPortalView } from "@/components/portal/PublicPortalView";
import Link from "next/link";

export const metadata = {
  title: "Portal de Transparencia | Tesorería CGPA",
  description: "Resumen financiero público del Centro de Padres y Apoderados",
};

export default async function PublicPortalPage() {
  if (!isPublicPortalEnabled()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d17] text-white p-6">
        <div className="glass-panel p-8 max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Portal no disponible</h1>
          <p className="text-white/60 text-sm mb-4">
            El portal público está desactivado. Contacta a la tesorería para más información.
          </p>
          <Link href="/" className="btn-primary inline-block">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const [summary, projects] = await Promise.all([
    getPublicTreasurySummary(),
    getPublicProjectsSummary(),
  ]);

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d17] text-white p-6">
        <div className="glass-panel p-8 max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Sin datos públicos</h1>
          <p className="text-white/60 text-sm">No hay información de tesorería disponible.</p>
        </div>
      </div>
    );
  }

  return <PublicPortalView summary={summary} projects={projects} />;
}
