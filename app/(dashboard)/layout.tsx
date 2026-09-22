import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { isPublicPortalEnabled } from "@/lib/public-portal";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar publicPortalEnabled={isPublicPortalEnabled()} />
      <div className="flex-1 flex flex-col relative overflow-hidden md:ml-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-8 z-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
