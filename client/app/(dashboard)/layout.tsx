"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <WorkspaceProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Desktop Sidebar */}
        <div
          className={cn(
            "hidden border-r bg-slate-950 md:block transition-all duration-300 ease-in-out",
            isSidebarCollapsed ? "md:w-[72px]" : "md:w-64 lg:w-72"
          )}
        >
          <Sidebar
            className="w-full"
            isCollapsed={isSidebarCollapsed}
            onNavigate={() => { }}
          />
        </div>

        {/* Mobile Sidebar Navigation */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64 md:hidden">
            <Sidebar className="w-full h-full" onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Areas */}
        <div className="flex flex-1 flex-col min-h-0">
          <Header
            onMenuClick={() => setSidebarOpen(true)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
