import Link from "next/link";
import { ArrowRight, BarChart3, Users, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-accent mb-8">
          <ShieldCheck className="w-4 h-4" />
          <span>Sistema de Gestión Seguro</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          La nueva era en <br />
          <span className="text-gradient">Gestión de Registros</span>
        </h1>
        
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
          Administra, analiza y automatiza tus datos financieros con una experiencia visual incomparable.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="btn-primary flex items-center gap-2">
            Comenzar Ahora <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Ver Demo
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left max-w-4xl mx-auto">
          {[
            {
              icon: <BarChart3 className="w-6 h-6 text-primary" />,
              title: "Estadísticas Avanzadas",
              desc: "Visualiza tus ingresos y egresos en tiempo real."
            },
            {
              icon: <Users className="w-6 h-6 text-accent" />,
              title: "Múltiples Roles",
              desc: "Control de acceso seguro para administradores y usuarios."
            },
            {
              icon: <ArrowRight className="w-6 h-6 text-success" />,
              title: "Automatizaciones",
              desc: "Exporta a PDF o envía reportes por correo de forma sencilla."
            }
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-6">
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
