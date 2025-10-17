import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <main className="flex-1 p-6 overflow-auto">
            <BreadcrumbNav />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
