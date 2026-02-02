import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Shirt,
  Trophy,
  Target,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import type { 
  MatchWithDetails, 
  MatchLineupWithPlayer, 
  MatchEventWithPlayer,
  Player,
  KitColor,
  Competition 
} from '@/lib/firestore-types';
import { cn } from '@/lib/utils';

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

const positionOrder = ['goalkeeper', 'defender', 'midfielder', 'forward'];

export default function MatchDetails() {
  const { id } = useParams();
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [lineups, setLineups] = useState<MatchLineupWithPlayer[]>([]);
  const [events, setEvents] = useState<MatchEventWithPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMatchDetails() {
      if (!id) return;

      try {
        // Fetch match
        const matchDoc = await getDoc(doc(db, 'matches', id));
        if (!matchDoc.exists()) {
          setIsLoading(false);
          return;
        }

        const matchDocData = matchDoc.data();
        const matchData = { id: matchDoc.id, ...matchDocData };

        // Fetch kit color and competition
        let kitColor: KitColor | null = null;
        let competition: Competition | null = null;

        if (matchDocData.kit_color_id) {
          const kitDoc = await getDoc(doc(db, 'kit_colors', matchDocData.kit_color_id));
          if (kitDoc.exists()) {
            kitColor = { id: kitDoc.id, ...kitDoc.data() } as KitColor;
          }
        }

        if (matchDocData.competition_id) {
          const compDoc = await getDoc(doc(db, 'competitions', matchDocData.competition_id));
          if (compDoc.exists()) {
            competition = { id: compDoc.id, ...compDoc.data() } as Competition;
          }
        }

        setMatch({
          ...matchData,
          kit_colors: kitColor,
          competitions: competition,
        } as MatchWithDetails);

        // Fetch players for enrichment
        const playersSnapshot = await getDocs(collection(db, 'players'));
        const playersMap = new Map<string, Player>();
        playersSnapshot.forEach(doc => {
          playersMap.set(doc.id, { id: doc.id, ...doc.data() } as Player);
        });

        // Fetch lineups from subcollection
        const lineupsSnapshot = await getDocs(collection(db, 'matches', id, 'lineups'));
        const lineupsData: MatchLineupWithPlayer[] = [];
        lineupsSnapshot.forEach(doc => {
          const data = doc.data();
          lineupsData.push({
            id: doc.id,
            ...data,
            players: playersMap.get(data.player_id) || null,
          } as MatchLineupWithPlayer);
        });
        setLineups(lineupsData);

        // Fetch events from subcollection
        const eventsSnapshot = await getDocs(
          query(collection(db, 'matches', id, 'events'), orderBy('minute'))
        );
        const eventsData: MatchEventWithPlayer[] = [];
        eventsSnapshot.forEach(doc => {
          const data = doc.data();
          eventsData.push({
            id: doc.id,
            ...data,
            players: playersMap.get(data.player_id) || null,
          } as MatchEventWithPlayer);
        });
        setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching match details:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMatchDetails();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Match not found</p>
        <Link to="/fixtures">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fixtures
          </Button>
        </Link>
      </div>
    );
  }

  const isCompleted = match.status === 'completed';
  const isWin = isCompleted && (match.goals_scored || 0) > (match.goals_conceded || 0);
  const isDraw = isCompleted && match.goals_scored === match.goals_conceded;

  const firstHalfLineup = lineups
    .filter((l) => l.lineup_type === 'first_half')
    .sort((a, b) => positionOrder.indexOf(a.position_played) - positionOrder.indexOf(b.position_played));
  
  const secondHalfLineup = lineups
    .filter((l) => l.lineup_type === 'second_half')
    .sort((a, b) => positionOrder.indexOf(a.position_played) - positionOrder.indexOf(b.position_played));
  
  const fullTimeLineup = lineups
    .filter((l) => l.lineup_type === 'full_time')
    .sort((a, b) => positionOrder.indexOf(a.position_played) - positionOrder.indexOf(b.position_played));

  const goals = events.filter((e) => e.event_type === 'goal');
  const assists = events.filter((e) => e.event_type === 'assist');
  const yellowCards = events.filter((e) => e.event_type === 'yellow_card');
  const redCards = events.filter((e) => e.event_type === 'red_card');

  const LineupSection = ({ lineup, title }: { lineup: MatchLineupWithPlayer[]; title: string }) => {
    if (lineup.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-foreground">{title}</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {lineup.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {l.players?.jersey_number}
              </div>
              <div>
                <p className="font-medium text-sm">{l.players?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {l.position_played}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Link to="/fixtures">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Fixtures
        </Button>
      </Link>

      {/* Match Header Card */}
      <Card className="overflow-hidden">
        <div
          className={cn(
            'p-6 text-center',
            isCompleted
              ? isWin
                ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10'
                : isDraw
                ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10'
                : 'bg-gradient-to-br from-rose-500/20 to-rose-600/10'
              : 'bg-gradient-to-br from-primary/20 to-primary/10'
          )}
        >
          <Badge
            className={cn(
              'mb-4',
              match.status === 'upcoming' && 'badge-upcoming',
              match.status === 'completed' && 'badge-completed'
            )}
          >
            {match.status === 'upcoming' ? 'Upcoming' : 'Full Time'}
          </Badge>

          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-white/90 mb-2">
                <img 
                  src="/sanbitu-logo.svg" 
                  alt="Sanbitu FC Logo" 
                  className="h-12 w-12 object-contain"
                />
              </div>
              <p className="font-display text-xl font-bold">Sanbitu FC</p>
            </div>

            {isCompleted ? (
              <div className="px-6 py-3 rounded-xl bg-background/80 backdrop-blur-sm">
                <p className="font-display text-4xl font-bold">
                  {match.goals_scored} - {match.goals_conceded}
                </p>
              </div>
            ) : (
              <div className="px-6 py-3">
                <p className="font-display text-2xl font-bold text-muted-foreground">
                  VS
                </p>
              </div>
            )}

            <div className="text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-muted mb-2">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-display text-xl font-bold">{match.opponent}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(toDate(match.match_date), 'EEEE, dd MMMM yyyy')}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {format(toDate(match.match_date), 'HH:mm')}
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {match.stadium && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="font-medium">{match.stadium}</p>
                </div>
              </div>
            )}
            {match.competitions && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Competition</p>
                  <p className="font-medium">{match.competitions.name}</p>
                </div>
              </div>
            )}
            {match.kit_colors && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Shirt className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Match Kit</p>
                    <p className="font-medium">{match.kit_colors.name}</p>
                  </div>
                  <div
                    className="h-6 w-6 rounded-full border-2 border-border"
                    style={{ backgroundColor: match.kit_colors.primary_color }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lineups */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Match Lineup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {lineups.length > 0 ? (
              <>
                <LineupSection lineup={firstHalfLineup} title="First Half" />
                <LineupSection lineup={secondHalfLineup} title="Second Half" />
                <LineupSection lineup={fullTimeLineup} title="Full Time" />
              </>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                Lineup not yet announced
              </p>
            )}
          </CardContent>
        </Card>

        {/* Match Events */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Match Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.length > 0 ? (
              <>
                {goals.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      ⚽ Goals
                    </h4>
                    {goals.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 py-2"
                      >
                        <Badge variant="outline" className="bg-emerald-500/10">
                          {event.minute}'
                        </Badge>
                        <span className="font-medium">
                          {event.players?.full_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {assists.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      🎯 Assists
                    </h4>
                    {assists.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 py-2"
                      >
                        <Badge variant="outline" className="bg-blue-500/10">
                          {event.minute}'
                        </Badge>
                        <span className="font-medium">
                          {event.players?.full_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {(yellowCards.length > 0 || redCards.length > 0) && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      📋 Cards
                    </h4>
                    {yellowCards.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="h-4 w-3 bg-yellow-400 rounded-sm" />
                        <Badge variant="outline">{event.minute}'</Badge>
                        <span>{event.players?.full_name}</span>
                      </div>
                    ))}
                    {redCards.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="h-4 w-3 bg-red-500 rounded-sm" />
                        <Badge variant="outline">{event.minute}'</Badge>
                        <span>{event.players?.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                No events recorded
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
