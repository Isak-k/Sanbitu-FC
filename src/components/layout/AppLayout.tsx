import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from './Navbar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopHeader } from './MobileTopHeader';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <Navbar />
      </div>
      
      {/* Mobile Navigation */}
      <div className="md:hidden">
        <MobileTopHeader />
        <MobileBottomNav />
      </div>

      {/* Main Content */}
      <main className={`
        container mx-auto px-4 py-6
        md:py-6
        pt-20 pb-20 md:pt-6 md:pb-6
      `}>
        <Outlet />
      </main>
    </div>
  );
}
