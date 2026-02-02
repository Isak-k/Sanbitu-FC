import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Calendar,
  Trophy,
  Target,
  ChevronRight,
  Clock,
  MapPin,
  Shirt,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { MatchWithDetails, Announcement, KitColor, Competition } from '@/lib/firestore-types';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalPlayers: 0,
    upcomingMatches: 0,
    matchesPlayed: 0,
    totalPoints: 0,
  });
  const [nextMatch, setNextMatch] = useState<MatchWithDetails | null>(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Real-time listener for players
    const playersQuery = query(
      collection(db, 'players'),
      where('is_active', '==', true)
    );
    
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot) => {
      const playerCount = snapshot.size;
      setStats(prev => ({ ...prev, totalPlayers: playerCount }));
    });
    unsubscribers.push(unsubscribePlayers);

    // Real-time listener for matches
    const unsubscribeMatches = onSnapshot(collection(db, 'matches'), async (matchesSnapshot) => {
      try {
        const matchesData: MatchWithDetails[] = [];
        
        // Get kit colors and competitions for enrichment
        const kitColorsSnapshot = await getDocs(collection(db, 'kit_colors'));
        const kitColorsMap = new Map<string, KitColor>();
        kitColorsSnapshot.forEach(doc => {
          kitColorsMap.set(doc.id, { id: doc.id, ...doc.data() } as KitColor);
        });
        
        const competitionsSnapshot = await getDocs(collection(db, 'competitions'));
        const competitionsMap = new Map<string, Competition>();
        competitionsSnapshot.forEach(doc => {
          competitionsMap.set(doc.id, { id: doc.id, ...doc.data() } as Competition);
        });

        matchesSnapshot.forEach(doc => {
          const data = doc.data();
          matchesData.push({
            id: doc.id,
            ...data,
            // Handle both old kit_color_id and new kit_color formats
            kit_colors: data.kit_color_id ? kitColorsMap.get(data.kit_color_id) || null : null,
            kit_color: data.kit_color || null, // New format: direct color string
            competitions: data.competition_id ? competitionsMap.get(data.competition_id) || null : null,
          } as MatchWithDetails);
        });

        const upcoming = matchesData.filter(m => m.status === 'upcoming');
        const completed = matchesData.filter(m => m.status === 'completed');
        const totalPoints = completed.reduce((acc, m) => acc + (m.points_earned || 0), 0);

        // Get next match
        const sortedUpcoming = upcoming.sort(
          (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
        );

        setStats(prev => ({
          ...prev,
          upcomingMatches: upcoming.length,
          matchesPlayed: completed.length,
          totalPoints,
        }));
        setNextMatch(sortedUpcoming[0] || null);
      } catch (error) {
        console.error('Error processing matches data:', error);
      }
    });
    unsubscribers.push(unsubscribeMatches);

    // Real-time listener for announcements
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('is_published', '==', true),
      orderBy('created_at', 'desc'),
      limit(3)
    );
    
    const unsubscribeAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsData: Announcement[] = [];
      snapshot.forEach(doc => {
        announcementsData.push({ id: doc.id, ...doc.data() } as Announcement);
      });
      setRecentAnnouncements(announcementsData);
    });
    unsubscribers.push(unsubscribeAnnouncements);

    // Set loading to false after initial setup
    setIsLoading(false);

    // Cleanup function to unsubscribe from all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // The real-time listeners will automatically update the data
    // This is just for visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const statCards = [
    {
      title: t('dashboard.squadSize'),
      value: stats.totalPlayers,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: t('dashboard.upcomingMatches'),
      value: stats.upcomingMatches,
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: t('dashboard.matchesPlayed'),
      value: stats.matchesPlayed,
      icon: Trophy,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('dashboard.totalPoints'),
      value: stats.totalPoints,
      icon: Target,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {t('dashboard.welcome')}
              {isAdmin && `, ${t('navigation.admin')}`}! 👋
            </h1>
            <p className="text-muted-foreground">
              {t('dashboard.overview')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-9 w-16 mt-1" />
                    ) : (
                      <p className="text-3xl font-bold font-display text-foreground mt-1">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next Match Card */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">{t('dashboard.nextMatch')}</CardTitle>
              <Link to="/fixtures">
                <Button variant="ghost" size="sm" className="text-primary">
                  {t('common.view')} {t('common.all')} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {nextMatch ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/90">
                      <img 
                        src="/sanbitu-logo.svg" 
                        alt="Sanbitu FC Logo" 
                        className="h-12 w-12 object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('fixtures.vs')}</p>
                      <p className="text-xl font-bold font-display text-foreground">
                        {nextMatch.opponent}
                      </p>
                    </div>
                  </div>
                  <Badge className="badge-upcoming">{t('fixtures.upcoming')}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      {format(new Date(nextMatch.match_date), 'PPP p')}
                    </span>
                  </div>
                  {nextMatch.stadium && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{nextMatch.stadium}</span>
                    </div>
                  )}
                  {nextMatch.competitions && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy className="h-4 w-4" />
                      <span className="text-sm">{nextMatch.competitions.name}</span>
                    </div>
                  )}
                  {nextMatch.kit_colors && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shirt className="h-4 w-4" />
                      <span className="text-sm">{nextMatch.kit_colors.name}</span>
                      <div
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: nextMatch.kit_colors.primary_color }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('dashboard.noMatches')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent News */}
        <Card>
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">{t('news.title')}</CardTitle>
              <Link to="/news">
                <Button variant="ghost" size="sm" className="text-primary">
                  {t('common.view')} {t('common.all')} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentAnnouncements.length > 0 ? (
              <div className="divide-y divide-border">
                {recentAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-foreground mb-1">
                      {announcement.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(announcement.created_at), 'PP')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('news.noNews')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions for Admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t('admin.panel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/players">
                <Button variant="outline" className="gap-2">
                  <Users className="h-4 w-4" />
                  {t('admin.addPlayer')}
                </Button>
              </Link>
              <Link to="/admin/matches">
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('admin.scheduleMatch')}
                </Button>
              </Link>
              <Link to="/admin/announcements">
                <Button variant="outline" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  {t('admin.postAnnouncement')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
