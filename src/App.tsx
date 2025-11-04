import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load heavy components
const Tasks = lazy(() => import("./pages/Tasks"));
const Templates = lazy(() => import("./pages/Templates"));
const Community = lazy(() => import("./pages/Community"));
const Team = lazy(() => import("./pages/Team"));
const Settings = lazy(() => import("./pages/Settings"));
const Help = lazy(() => import("./pages/Help"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FeedbackWidget />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/signup" element={<Index />} />
              <Route path="/login" element={<Index />} />
              <Route path="/onboarding/profile" element={<Index />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/session/new" element={<Index />} />
              <Route path="/session/upload-audio" element={<Index />} />
              <Route path="/session/:id/record" element={<Index />} />
              <Route path="/session/:id/review" element={<Index />} />
              <Route path="/sessions" element={<Index />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/community" element={<Community />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
