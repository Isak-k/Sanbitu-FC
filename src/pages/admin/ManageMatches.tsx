import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Trophy,
  Calendar,
  Edit,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { MatchWithDetails, Competition } from '@/lib/firestore-types';
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

export default function ManageMatches() {
  const { t } = useTranslation();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined competition types
  const defaultCompetitions: Competition[] = [
    { id: 'league', name: t('matches.competitions.league'), created_at: new Date().toISOString() },
    { id: 'derby', name: t('matches.competitions.derby'), created_at: new Date().toISOString() },
    { id: 'cup', name: t('matches.competitions.cup'), created_at: new Date().toISOString() },
    { id: 'international', name: t('matches.competitions.international'), created_at: new Date().toISOString() },
    { id: 'qualification', name: t('matches.competitions.qualification'), created_at: new Date().toISOString() },
    { id: 'final', name: t('matches.competitions.final'), created_at: new Date().toISOString() },
    { id: 'friendly', name: t('matches.competitions.friendly'), created_at: new Date().toISOString() },
  ];

  // Form state
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [stadium, setStadium] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [kitColor, setKitColor] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch matches and competitions (no longer need kit colors)
      const [matchesSnapshot, competitionsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'matches'), orderBy('match_date', 'desc'))),
        getDocs(collection(db, 'competitions')),
      ]);

      const competitionsMap = new Map<string, Competition>();
      const competitionsData: Competition[] = [...defaultCompetitions]; // Start with default competitions
      
      // Add database competitions (if any)
      competitionsSnapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as Competition;
        competitionsMap.set(doc.id, data);
        // Only add if not already in defaults
        if (!defaultCompetitions.find(def => def.id === doc.id)) {
          competitionsData.push(data);
        }
      });
      
      // Also add default competitions to the map for lookup
      defaultCompetitions.forEach(comp => {
        if (comp.id) {
          competitionsMap.set(comp.id, comp);
        }
      });

      const matchesData: MatchWithDetails[] = [];
      matchesSnapshot.forEach(doc => {
        const data = doc.data();
        matchesData.push({
          id: doc.id,
          ...data,
          competitions: data.competition_id ? competitionsMap.get(data.competition_id) || null : null,
        } as MatchWithDetails);
      });

      setMatches(matchesData);
      setCompetitions(competitionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const resetForm = () => {
    setOpponent('');
    setMatchDate('');
    setMatchTime('');
    setStadium('');
    setCompetitionId('');
    setKitColor('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dateTime = new Date(`${matchDate}T${matchTime}`);

      await addDoc(collection(db, 'matches'), {
        opponent: opponent.trim(),
        match_date: dateTime.toISOString(),
        stadium: stadium.trim() || null,
        competition_id: competitionId || null,
        kit_color: kitColor.trim() || null, // Store as string instead of ID
        status: 'upcoming',
        goals_scored: null,
        goals_conceded: null,
        points_earned: null,
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast({
        title: t('matches.matchScheduled'),
        description: t('matches.matchScheduledDesc', { opponent }),
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('matches.failedToSchedule'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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

  const toggleVisibility = async (matchId: string, currentVisibility: boolean) => {
    try {
      const newVisibility = !currentVisibility;
      await updateDoc(doc(db, 'matches', matchId), {
        is_visible: newVisibility,
      });

      toast({
        title: newVisibility ? t('matches.matchVisible') : t('matches.matchHidden'),
        description: t('matches.visibilityUpdated'),
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('common.failedToUpdate'),
        variant: 'destructive',
      });
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (!window.confirm(t('common.confirmDelete'))) return;

    try {
      // Delete subcollections first (lineups and events)
      const [lineupsSnapshot, eventsSnapshot] = await Promise.all([
        getDocs(collection(db, 'matches', matchId, 'lineups')),
        getDocs(collection(db, 'matches', matchId, 'events'))
      ]);

      // Delete all lineups
      const lineupDeletions = lineupsSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );

      // Delete all events
      const eventDeletions = eventsSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );

      // Wait for all subcollection deletions to complete
      await Promise.all([...lineupDeletions, ...eventDeletions]);

      // Finally delete the match document
      await deleteDoc(doc(db, 'matches', matchId));

      toast({
        title: t('common.deleted'),
        description: t('matches.matchDeleted'),
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('common.failedToDelete'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {t('admin.manageMatches')}
            </h1>
            <p className="text-muted-foreground">
              {matches.length} {t('common.total')} {t('fixtures.title')}
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" />
              {t('matches.scheduleNewMatch')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">{t('matches.scheduleNewMatch')}</DialogTitle>
              <DialogDescription>
                {t('matches.enterMatchDetails')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="opponent">{t('matches.opponent')}</Label>
                  <Input
                    id="opponent"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder={t('matches.opponentPlaceholder')}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="matchDate">{t('matches.matchDate')}</Label>
                    <Input
                      id="matchDate"
                      type="date"
                      value={matchDate}
                      onChange={(e) => setMatchDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="matchTime">{t('matches.matchTime')}</Label>
                    <Input
                      id="matchTime"
                      type="time"
                      value={matchTime}
                      onChange={(e) => setMatchTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stadium">{t('matches.stadium')}</Label>
                  <Input
                    id="stadium"
                    value={stadium}
                    onChange={(e) => setStadium(e.target.value)}
                    placeholder={t('matches.stadiumPlaceholder')}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="competition">{t('matches.competition')}</Label>
                    <Select value={competitionId} onValueChange={setCompetitionId}>
                      <SelectTrigger id="competition">
                        <SelectValue placeholder={t('matches.selectCompetition')} />
                      </SelectTrigger>
                      <SelectContent>
                        {competitions.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id!}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="kitColor">{t('matches.kitColor')}</Label>
                    <Input
                      id="kitColor"
                      value={kitColor}
                      onChange={(e) => setKitColor(e.target.value)}
                      placeholder={t('matches.kitColorPlaceholder')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {matches.map((match) => (
          <Card key={match.id} className="border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                {/* Match Info */}
                <div className="flex-1 p-6 flex flex-col justify-center border-r border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10">
                      {match.competitions?.name || t('common.none')}
                    </Badge>
                    <Badge className={cn(
                      match.status === 'upcoming' ? 'badge-upcoming' : 'badge-completed'
                    )}>
                      {match.status === 'upcoming' ? t('fixtures.upcoming') : t('fixtures.completed')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex-1 text-right">
                      <p className="font-display text-xl font-bold">Sanbitu FC</p>
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-muted font-display text-2xl font-bold">
                      {match.status === 'completed' ? (
                        `${match.goals_scored} - ${match.goals_conceded}`
                      ) : (
                        'VS'
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-xl font-bold">{match.opponent}</p>
                    </div>
                  </div>
                </div>

                {/* Date & Venue */}
                <div className="bg-muted/30 p-6 flex flex-col justify-center gap-3 md:w-64 border-r border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(toDate(match.match_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    {match.stadium}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 flex items-center justify-end gap-2 md:w-48">
                  <Link to={`/admin/match/${match.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Edit className="h-4 w-4" />
                      {t('common.manage')}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibility(match.id!, match.is_visible !== false)}
                    className="text-muted-foreground"
                    title={match.is_visible !== false ? t('matches.hideMatch') : t('matches.showMatch')}
                  >
                    {match.is_visible !== false ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMatch(match.id!)}
                    className="text-muted-foreground hover:text-destructive"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {matches.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">{t('fixtures.noFixtures')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
