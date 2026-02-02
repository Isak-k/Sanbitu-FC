import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Calendar, 
  Image, 
  Newspaper 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const navigationItems = [
  {
    name: 'home',
    href: '/dashboard',
    icon: Home,
    label: 'Home'
  },
  {
    name: 'squad',
    href: '/squad',
    icon: Users,
    label: 'Squad'
  },
  {
    name: 'fixtures',
    href: '/fixtures',
    icon: Calendar,
    label: 'Fixtures'
  },
  {
    name: 'gallery',
    href: '/gallery',
    icon: Image,
    label: 'Gallery'
  },
  {
    name: 'news',
    href: '/news',
    icon: Newspaper,
    label: 'News'
  }
];

export function MobileBottomNav() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden mobile-safe-bottom">
      <nav className="flex items-center justify-around px-2 py-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 min-h-[48px] flex-1",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 mb-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-medium truncate",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {t(`navigation.${item.name}`)}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
