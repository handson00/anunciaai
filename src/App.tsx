import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import Index from "./pages/Index";

const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const CreateAdPage = lazy(() => import("./pages/CreateAdPage"));
const MyAdsPage = lazy(() => import("./pages/MyAdsPage"));
const AdDetailPage = lazy(() => import("./pages/AdDetailPage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-ad" element={<CreateAdPage />} />
              <Route path="/my-ads" element={<MyAdsPage />} />
              <Route path="/ad/:slug" element={<AdDetailPage />} />
              <Route path="/edit-profile" element={<EditProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
