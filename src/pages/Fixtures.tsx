import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, orderBy, getDocs, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Calendar,
  Trophy,
  Clock,
  MapPin,
  Shirt,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import type { MatchWithDetails, KitColor, Competition } from '@/lib/firestore-types';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Helper to convert Firestore Timestamp or string to Date
const toDate = (value: unknown): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date();
};

export default function Fixtures() {
  const { t } = useTranslation();
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up real-time listener for matches
    const matchesQuery = query(collection(db, 'matches'), orderBy('match_date', 'asc'));
    
    const unsubscribe = onSnapshot(matchesQuery, async (matchesSnapshot) => {
      try {
        // Fetch kit colors and competitions for enrichment
        const [kitColorsSnapshot, competitionsSnapshot] = await Promise.all([
          getDocs(collection(db, 'kit_colors')),
          getDocs(collection(db, 'competitions')),
        ]);

        const kitColorsMap = new Map<string, KitColor>();
        kitColorsSnapshot.forEach(doc => {
          kitColorsMap.set(doc.id, { id: doc.id, ...doc.data() } as KitColor);
        });

        const competitionsMap = new Map<string, Competition>();
        competitionsSnapshot.forEach(doc => {
          competitionsMap.set(doc.id, { id: doc.id, ...doc.data() } as Competition);
        });

        const matchesData: MatchWithDetails[] = [];
        matchesSnapshot.forEach(doc => {
          const data = doc.data();
          // Only include visible matches (treat undefined as visible for backward compatibility)
          if (data.is_visible !== false) {
            matchesData.push({
              id: doc.id,
              ...data,
              // Handle both old kit_color_id and new kit_color formats
              kit_colors: data.kit_color_id ? kitColorsMap.get(data.kit_color_id) || null : null,
              kit_color: data.kit_color || null, // New format: direct color string
              competitions: data.competition_id ? competitionsMap.get(data.competition_id) || null : null,
            } as MatchWithDetails);
          }
        });

        setMatches(matchesData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing matches data:', error);
        setIsLoading(false);
      }
    }, (error) => {
      console.error('Error fetching matches:', error);
      setIsLoading(false);
    });

    // Cleanup function
    return () => unsubscribe();
  }, []);

  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');
  const completedMatches = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => toDate(b.match_date).getTime() - toDate(a.match_date).getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const MatchCard = ({ match }: { match: MatchWithDetails }) => {
    const isCompleted = match.status === 'completed';
    const isWin = isCompleted && (match.goals_scored || 0) > (match.goals_conceded || 0);
    const isDraw = isCompleted && match.goals_scored === match.goals_conceded;
    const isLoss = isCompleted && (match.goals_scored || 0) < (match.goals_conceded || 0);

    return (
      <Card className="match-card overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-4 p-4">
          {/* Date/Time */}
          <div className="flex-shrink-0 text-center md:text-left md:w-32">
            <p className="font-display text-lg font-bold text-foreground">
              {format(toDate(match.match_date), 'dd MMM')}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(toDate(match.match_date), 'HH:mm')}
            </p>
          </div>

          {/* Main content */}
          <div className="flex-1 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90">
                <img 
                  src="/sanbitu-logo.svg" 
                  alt="Sanbitu FC Logo" 
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  vs {match.opponent}
                </p>
                {match.competitions && (
                  <p className="text-sm text-muted-foreground">
                    {match.competitions.name}
                  </p>
                )}
              </div>
            </div>

            {/* Score or Status */}
            {isCompleted ? (
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'px-4 py-2 rounded-lg font-display text-xl font-bold',
                    isWin && 'bg-emerald-500/10 text-emerald-600',
                    isDraw && 'bg-amber-500/10 text-amber-600',
                    isLoss && 'bg-rose-500/10 text-rose-600'
                  )}
                >
                  {match.goals_scored} - {match.goals_conceded}
                </div>
                <Badge
                  className={cn(
                    isWin && 'bg-emerald-500/20 text-emerald-700',
                    isDraw && 'bg-amber-500/20 text-amber-700',
                    isLoss && 'bg-rose-500/20 text-rose-700'
                  )}
                >
                  {isWin ? 'W' : isDraw ? 'D' : 'L'}
                </Badge>
              </div>
            ) : (
              <Badge className="badge-upcoming">Upcoming</Badge>
            )}
          </div>

          {/* Details and link */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground md:border-l md:border-border md:pl-4">
            {match.stadium && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">{match.stadium}</span>
              </div>
            )}
            {match.kit_colors && (
              <div className="flex items-center gap-1">
                <Shirt className="h-4 w-4" />
                <div
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: match.kit_colors.primary_color }}
                />
              </div>
            )}
            <Link to={`/match/${match.id}`}>
              <Button variant="ghost" size="sm" className="text-primary">
                Details <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Fixtures & Results
            </h1>
            <p className="text-muted-foreground">
              {matches.length} matches this season
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming" className="gap-2">
            <Clock className="h-4 w-4" />
            Upcoming ({upcomingMatches.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <Trophy className="h-4 w-4" />
            Results ({completedMatches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingMatches.length > 0 ? (
            upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No upcoming matches scheduled</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {completedMatches.length > 0 ? (
            completedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No results yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
