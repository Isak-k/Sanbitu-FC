import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Users,
  Target,
  Plus,
  X,
  Save,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { 
  MatchWithDetails, 
  Player, 
  MatchLineup, 
  MatchEvent,
  KitColor,
  Competition,
  LineupType, 
  PlayerPosition,
  EventType 
} from '@/lib/firestore-types';
import { cn } from '@/lib/utils';

const lineupTypes: LineupType[] = ['first_half', 'second_half', 'full_time'];
const positions: PlayerPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];
const eventTypes: EventType[] = ['goal', 'assist', 'yellow_card', 'red_card'];

export default function ManageMatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin, isLoading: authLoading } = useAuth();
  
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Match result state
  const [goalsScored, setGoalsScored] = useState('0');
  const [goalsConceded, setGoalsConceded] = useState('0');
  const [status, setStatus] = useState('upcoming');

  // Lineup state
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<PlayerPosition>('midfielder');
  const [selectedLineupType, setSelectedLineupType] = useState<LineupType>('first_half');

  // Event state
  const [eventPlayer, setEventPlayer] = useState('');
  const [eventType, setEventType] = useState<EventType>('goal');
  const [eventMinute, setEventMinute] = useState('');

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    if (!id) return;
    
    try {
      // Fetch match
      const matchDoc = await getDoc(doc(db, 'matches', id));
      if (!matchDoc.exists()) {
        setIsLoading(false);
        return;
      }
      
      const matchData = matchDoc.data();
      
      // Fetch kit color and competition
      let kitColor: KitColor | null = null;
      let competition: Competition | null = null;
      
      if (matchData.kit_color_id) {
        const kitDoc = await getDoc(doc(db, 'kit_colors', matchData.kit_color_id));
        if (kitDoc.exists()) {
          kitColor = { id: kitDoc.id, ...kitDoc.data() } as KitColor;
        }
      }
      
      if (matchData.competition_id) {
        const compDoc = await getDoc(doc(db, 'competitions', matchData.competition_id));
        if (compDoc.exists()) {
          competition = { id: compDoc.id, ...compDoc.data() } as Competition;
        }
      }
      
      const matchWithDetails: MatchWithDetails = {
        id: matchDoc.id,
        ...matchData,
        kit_colors: kitColor,
        competitions: competition,
      } as MatchWithDetails;
      
      setMatch(matchWithDetails);
      setGoalsScored(matchData.goals_scored?.toString() || '0');
      setGoalsConceded(matchData.goals_conceded?.toString() || '0');
      setStatus(matchData.status);

      // Fetch active players (no orderBy to avoid composite index requirement)
      const playersQuery = query(
        collection(db, 'players'),
        where('is_active', '==', true)
      );
      const playersSnapshot = await getDocs(playersQuery);
      const playersData: Player[] = [];
      playersSnapshot.forEach(doc => {
        playersData.push({ id: doc.id, ...doc.data() } as Player);
      });
      // Sort by jersey number in JavaScript
      playersData.sort((a, b) => a.jersey_number - b.jersey_number);
      setPlayers(playersData);

      // Fetch lineups from subcollection
      const lineupsSnapshot = await getDocs(collection(db, 'matches', id, 'lineups'));
      const lineupsData: MatchLineup[] = [];
      lineupsSnapshot.forEach(doc => {
        lineupsData.push({ id: doc.id, ...doc.data() } as MatchLineup);
      });
      setLineups(lineupsData);

      // Fetch events from subcollection
      const eventsQuery = query(
        collection(db, 'matches', id, 'events'),
        orderBy('minute')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData: MatchEvent[] = [];
      eventsSnapshot.forEach(doc => {
        eventsData.push({ id: doc.id, ...doc.data() } as MatchEvent);
      });
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const addToLineup = async () => {
    if (!selectedPlayer || !id) return;

    try {
      await addDoc(collection(db, 'matches', id, 'lineups'), {
        match_id: id,
        player_id: selectedPlayer,
        lineup_type: selectedLineupType,
        position_played: selectedPosition,
        created_at: new Date().toISOString(),
      });

      toast({ title: t('matches.playerAddedToLineup') });
      setSelectedPlayer('');
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeFromLineup = async (lineupId: string) => {
    if (!id) return;
    
    try {
      await deleteDoc(doc(db, 'matches', id, 'lineups', lineupId));
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addEvent = async () => {
    if (!eventPlayer || !id) return;

    try {
      await addDoc(collection(db, 'matches', id, 'events'), {
        match_id: id,
        player_id: eventPlayer,
        event_type: eventType,
        minute: eventMinute ? parseInt(eventMinute) : null,
        created_at: new Date().toISOString(),
      });

      toast({ title: t('matches.eventRecorded') });
      setEventPlayer('');
      setEventMinute('');
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeEvent = async (eventId: string) => {
    if (!id) return;
    
    try {
      await deleteDoc(doc(db, 'matches', id, 'events', eventId));
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const saveMatchResult = async () => {
    if (!id) return;
    setIsSaving(true);

    try {
      const points =
        parseInt(goalsScored) > parseInt(goalsConceded)
          ? 3
          : parseInt(goalsScored) === parseInt(goalsConceded)
          ? 1
          : 0;

      await updateDoc(doc(db, 'matches', id), {
        goals_scored: parseInt(goalsScored),
        goals_conceded: parseInt(goalsConceded),
        points_earned: points,
        status,
        updated_at: new Date().toISOString(),
      });

      toast({ title: t('matches.matchUpdatedSuccessfully') });
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const printLineup = () => {
    window.print();
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('matches.matchNotFound')}</p>
      </div>
    );
  }

  const getLineupByType = (type: LineupType) =>
    lineups.filter((l) => l.lineup_type === type);

  const getPlayerById = (playerId: string) =>
    players.find((p) => p.id === playerId);

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/admin/matches')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <Button variant="outline" onClick={printLineup} className="gap-2">
          <Printer className="h-4 w-4" />
          {t('matches.printLineup')}
        </Button>
      </div>

      {/* Match Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/90">
                <img 
                  src="/sanbitu-logo.svg" 
                  alt="Sanbitu FC Logo" 
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div>
                <p className="font-display text-xl font-bold">{t('fixtures.vs')} {match.opponent}</p>
                <p className="text-muted-foreground">
                  {format(toDate(match.match_date), 'PPP • HH:mm')}
                </p>
              </div>
            </div>
            {match.kit_colors && (
              <div className="flex items-center gap-2 print:block">
                <span className="text-sm text-muted-foreground">{t('matches.kit')}:</span>
                <div
                  className="h-8 w-8 rounded-lg border-2"
                  style={{ backgroundColor: match.kit_colors.primary_color }}
                />
                <span className="font-medium">{match.kit_colors.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lineup" className="print:hidden">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="lineup" className="gap-2">
            <Users className="h-4 w-4" />
            {t('matches.lineup')}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Target className="h-4 w-4" />
            {t('matches.events')}
          </TabsTrigger>
          <TabsTrigger value="result" className="gap-2">
            <Trophy className="h-4 w-4" />
            {t('fixtures.result')}
          </TabsTrigger>
        </TabsList>

        {/* Lineup Tab */}
        <TabsContent value="lineup" className="space-y-6">
          {/* Add Player to Lineup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('matches.addToLineup')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('matches.selectPlayer')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id!}>
                        #{p.jersey_number} {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedPosition}
                  onValueChange={(v) => setSelectedPosition(v as PlayerPosition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos} className="capitalize">
                        {t(`squad.${pos}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedLineupType}
                  onValueChange={(v) => setSelectedLineupType(v as LineupType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="first_half">{t('matches.firstHalf')}</SelectItem>
                    <SelectItem value="second_half">{t('matches.secondHalf')}</SelectItem>
                    <SelectItem value="full_time">{t('matches.fullTime')}</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={addToLineup} disabled={!selectedPlayer}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lineup Display */}
          <div className="grid gap-6 md:grid-cols-3">
            {lineupTypes.map((type) => {
              const lineup = getLineupByType(type);
              return (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base capitalize">
                      {t(`matches.${type}`)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lineup.length > 0 ? (
                      <div className="space-y-2">
                        {lineup.map((l) => {
                          const player = getPlayerById(l.player_id);
                          return (
                            <div
                              key={l.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-primary">
                                  #{player?.jersey_number}
                                </span>
                                <span className="text-sm">{player?.full_name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeFromLineup(l.id!)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('matches.noPlayersAdded')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('matches.recordEvent')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <Select value={eventPlayer} onValueChange={setEventPlayer}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('matches.selectPlayer')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id!}>
                        #{p.jersey_number} {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={eventType}
                  onValueChange={(v) => setEventType(v as EventType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="goal">⚽ {t('matches.goal')}</SelectItem>
                    <SelectItem value="assist">🎯 {t('matches.assist')}</SelectItem>
                    <SelectItem value="yellow_card">🟨 {t('matches.yellowCard')}</SelectItem>
                    <SelectItem value="red_card">🟥 {t('matches.redCard')}</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  placeholder={t('matches.minute')}
                  value={eventMinute}
                  onChange={(e) => setEventMinute(e.target.value)}
                  min="1"
                  max="120"
                />

                <Button onClick={addEvent} disabled={!eventPlayer}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('matches.events')}</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((event) => {
                    const player = getPlayerById(event.player_id);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {event.minute ? `${event.minute}'` : '-'}
                          </Badge>
                          <span>
                            {event.event_type === 'goal' && '⚽'}
                            {event.event_type === 'assist' && '🎯'}
                            {event.event_type === 'yellow_card' && '🟨'}
                            {event.event_type === 'red_card' && '🟥'}
                          </span>
                          <span className="font-medium">{player?.full_name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEvent(event.id!)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">
                  {t('matches.noEventsRecorded')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('matches.matchResult')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('matches.goalsScored')}</Label>
                  <Input
                    type="number"
                    value={goalsScored}
                    onChange={(e) => setGoalsScored(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('matches.goalsConceded')}</Label>
                  <Input
                    type="number"
                    value={goalsConceded}
                    onChange={(e) => setGoalsConceded(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('matches.status')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="upcoming">{t('fixtures.upcoming')}</SelectItem>
                    <SelectItem value="completed">{t('fixtures.completed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={saveMatchResult} disabled={isSaving} className="w-full gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('matches.saveResult')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print-friendly lineup display */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold mb-4">{t('matches.lineup')}</h2>
        {lineupTypes.map((type) => {
          const lineup = getLineupByType(type);
          if (lineup.length === 0) return null;
          return (
            <div key={type} className="mb-6">
              <h3 className="font-bold capitalize mb-2">{t(`matches.${type}`)}</h3>
              <ul>
                {lineup.map((l) => {
                  const player = getPlayerById(l.player_id);
                  return (
                    <li key={l.id}>
                      #{player?.jersey_number} - {player?.full_name} ({t(`squad.${l.position_played}`)})
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
