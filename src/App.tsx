import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Tasks from "./pages/Tasks";
import Templates from "./pages/Templates";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/signup" element={<Index />} />
          <Route path="/login" element={<Index />} />
          <Route path="/onboarding/profile" element={<Index />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/session/new" element={<Index />} />
          <Route path="/session/:id/record" element={<Index />} />
          <Route path="/session/:id/review" element={<Index />} />
          <Route path="/sessions" element={<Index />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
