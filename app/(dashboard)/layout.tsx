import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden md:ml-0">
        
        {/* Background ambient effects */}
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/10 rounded-full blur-[120px] pointer-events-none translate-y-1/2 -translate-x-1/2" />

        <Navbar />
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-8 z-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
