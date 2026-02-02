import { Link } from 'react-router-dom';
import { 
  Settings, 
  Bell, 
  Globe, 
  Sun, 
  Moon,
  User,
  RefreshCw,
  LogOut,
  Trophy,
  Users,
  Newspaper,
  Image as ImageIcon,
  UserCog,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { NotificationBell } from '@/components/NotificationBell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function MobileTopHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const handleRefresh = () => {
    window.location.reload();
  };

  const adminItems = [
    { href: '/admin/players', label: 'admin.managePlayers', icon: Users },
    { href: '/admin/matches', label: 'admin.manageMatches', icon: Trophy },
    { href: '/admin/announcements', label: 'admin.announcements', icon: Newspaper },
    { href: '/admin/gallery', label: 'admin.manageGallery', icon: ImageIcon },
    { href: '/admin/create-user', label: 'admin.createUser', icon: Settings },
    { href: '/admin/manage-users', label: 'admin.manageUsers', icon: UserCog },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border md:hidden mobile-safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Admin/Settings */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-12 w-12 p-0">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover mt-2">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('admin.panel')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link to={item.href} className="flex items-center gap-3 py-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span>{t(item.label)}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-destructive focus:text-destructive flex items-center gap-3 py-3"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{t('navigation.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-12 w-12 p-0"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        {/* Center - Logo/Title */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">SF</span>
          </div>
          <span className="font-display font-bold text-foreground text-sm">Sanbitu FC</span>
        </div>

        {/* Right side - Notifications, Language, Theme, Profile */}
        <div className="flex items-center gap-1">
          <NotificationBell />
          <LanguageSwitcher />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-12 w-12 p-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-12 w-12 p-0 rounded-full">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover mt-2">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.displayName || t('users.user')}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive flex items-center gap-3 py-2.5"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('navigation.signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
