import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Trophy, Shield, Users, Calendar } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient relative overflow-hidden">
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo and Club Name */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <img 
                  src="/sanbitu-logo.svg" 
                  alt="Sanbitu FC Logo" 
                  className="h-12 w-12 object-contain filter brightness-0 invert"
                />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  Sanbitu FC
                </h1>
                <p className="text-white/70 text-sm">Established 2014</p>
              </div>
            </div>
            
            <h2 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              {t('auth.welcomeBack')}
              <br />
              <span className="text-gradient-gold">{t('dashboard.welcome')}</span>
            </h2>
            
            <p className="text-white/70 text-lg max-w-md">
              {t('auth.enterCredentials')}
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-white/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Users className="h-5 w-5" />
              </div>
              <span>View squad & player profiles</span>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Calendar className="h-5 w-5" />
              </div>
              <span>Match fixtures & live results</span>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Shield className="h-5 w-5" />
              </div>
              <span>Exclusive member access</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        {/* Language Switcher - Top Right */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center">
              <img 
                src="/sanbitu-logo.svg" 
                alt="Sanbitu FC Logo" 
                className="h-12 w-12 object-contain"
              />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">
                Sanbitu FC
              </h1>
              <p className="text-xs text-muted-foreground">Est. 2014</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {t('auth.signInToAccount')}
            </h2>
            <p className="text-muted-foreground">
              {t('auth.enterCredentials')}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
            <LoginForm />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © 2024 Sanbitu Football Club. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
