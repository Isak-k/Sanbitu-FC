import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import OfflineStatus from "@/components/OfflineStatus";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Squad from "./pages/Squad";
import Fixtures from "./pages/Fixtures";
import MatchDetails from "./pages/MatchDetails";
import News from "./pages/News";
import Gallery from "./pages/Gallery";
import NotFound from "./pages/NotFound";

// Admin Pages
import ManagePlayers from "./pages/admin/ManagePlayers";
import ManageMatches from "./pages/admin/ManageMatches";
import ManageMatchDetails from "./pages/admin/ManageMatchDetails";
import ManageAnnouncements from "./pages/admin/ManageAnnouncements";
import ManageGallery from "./pages/admin/ManageGallery";
import CreateUser from "./pages/admin/CreateUser";
import ManageUsers from "./pages/admin/ManageUsers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineStatus />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/squad" element={<Squad />} />
              <Route path="/fixtures" element={<Fixtures />} />
              <Route path="/match/:id" element={<MatchDetails />} />
              <Route path="/news" element={<News />} />
              <Route path="/gallery" element={<Gallery />} />

              {/* Admin routes */}
              <Route path="/admin/players" element={<ManagePlayers />} />
              <Route path="/admin/matches" element={<ManageMatches />} />
              <Route path="/admin/match/:id" element={<ManageMatchDetails />} />
              <Route path="/admin/announcements" element={<ManageAnnouncements />} />
              <Route path="/admin/gallery" element={<ManageGallery />} />
              <Route path="/admin/create-user" element={<CreateUser />} />
              <Route path="/admin/manage-users" element={<ManageUsers />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
