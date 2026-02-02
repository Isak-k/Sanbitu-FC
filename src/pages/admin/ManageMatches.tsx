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
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined competition types
  const defaultCompetitions: Competition[] = [
    { id: 'league', name: 'League Matches', created_at: new Date().toISOString() },
    { id: 'derby', name: 'Derby Matches', created_at: new Date().toISOString() },
    { id: 'cup', name: 'Cup Matches', created_at: new Date().toISOString() },
    { id: 'international', name: 'International Matches', created_at: new Date().toISOString() },
    { id: 'qualification', name: 'Qualification Matches', created_at: new Date().toISOString() },
    { id: 'final', name: 'Final Matches', created_at: new Date().toISOString() },
    { id: 'friendly', name: 'Friendly Matches', created_at: new Date().toISOString() },
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
        title: 'Match Scheduled',
        description: `Match against ${opponent} has been scheduled.`,
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule match.',
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

  const toggleVisibility = async (match: MatchWithDetails) => {
    if (!match.id) return;
    
    try {
      const newVisibility = !(match.is_visible !== false);
      await updateDoc(doc(db, 'matches', match.id), {
        is_visible: newVisibility,
      });

      toast({
        title: newVisibility ? 'Match Visible' : 'Match Hidden',
        description: `Match vs ${match.opponent} is now ${newVisibility ? 'visible' : 'hidden'} to users.`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update visibility.',
        variant: 'destructive',
      });
    }
  };

  const deleteMatch = async (match: MatchWithDetails) => {
    if (!match.id) return;

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete the match against ${match.opponent}?\n\n` +
      `Date: ${format(toDate(match.match_date), 'PPP p')}\n` +
      `This will also delete all associated lineups and events.\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // Delete subcollections first (lineups and events)
      const [lineupsSnapshot, eventsSnapshot] = await Promise.all([
        getDocs(collection(db, 'matches', match.id, 'lineups')),
        getDocs(collection(db, 'matches', match.id, 'events'))
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
      await deleteDoc(doc(db, 'matches', match.id));

      toast({
        title: 'Match Deleted',
        description: `Match against ${match.opponent} and all associated data have been deleted successfully.`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete match.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Manage Matches
            </h1>
            <p className="text-muted-foreground text-sm">
              {matches.length} matches scheduled
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Schedule Match
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="font-display">Schedule New Match</DialogTitle>
              <DialogDescription>
                Add a new match to the fixture list
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="opponent">Opponent *</Label>
                <Input
                  id="opponent"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Opponent team name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="matchDate">Date *</Label>
                  <Input
                    id="matchDate"
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matchTime">Time *</Label>
                  <Input
                    id="matchTime"
                    type="time"
                    value={matchTime}
                    onChange={(e) => setMatchTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stadium">Stadium</Label>
                <Input
                  id="stadium"
                  value={stadium}
                  onChange={(e) => setStadium(e.target.value)}
                  placeholder="Match venue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Competition</Label>
                  <Select value={competitionId} onValueChange={setCompetitionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {competitions.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id!}>
                          {comp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kitColor">Match Kit Color</Label>
                  <Input
                    id="kitColor"
                    value={kitColor}
                    onChange={(e) => setKitColor(e.target.value)}
                    placeholder="e.g., Red, Blue, White, Green"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Schedule Match
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Matches List */}
      <div className="space-y-4">
        {matches.map((match) => {
          const isCompleted = match.status === 'completed';
          const isWin = isCompleted && (match.goals_scored || 0) > (match.goals_conceded || 0);
          const isDraw = isCompleted && match.goals_scored === match.goals_conceded;

          return (
            <Card key={match.id} className="match-card">
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-4">
                <div className="flex-shrink-0 text-center md:text-left md:w-28">
                  <p className="font-display font-bold text-foreground">
                    {format(toDate(match.match_date), 'dd MMM')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(toDate(match.match_date), 'HH:mm')}
                  </p>
                </div>

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
                      <p className="font-display font-bold text-foreground">
                        vs {match.opponent}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {match.competitions && (
                          <span>{match.competitions.name}</span>
                        )}
                        {match.competitions && match.kit_color && (
                          <span>•</span>
                        )}
                        {match.kit_color && (
                          <span className="flex items-center gap-1">
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: match.kit_color.toLowerCase() }}
                            />
                            {match.kit_color}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isCompleted ? (
                    <div
                      className={cn(
                        'px-4 py-2 rounded-lg font-display text-lg font-bold',
                        isWin && 'bg-emerald-500/10 text-emerald-600',
                        isDraw && 'bg-amber-500/10 text-amber-600',
                        !isWin && !isDraw && 'bg-rose-500/10 text-rose-600'
                      )}
                    >
                      {match.goals_scored} - {match.goals_conceded}
                    </div>
                  ) : (
                    <Badge className="badge-upcoming">Upcoming</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibility(match)}
                    title={match.is_visible !== false ? 'Hide from users' : 'Show to users'}
                  >
                    {match.is_visible !== false ? (
                      <Eye className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMatch(match)}
                    title="Delete match"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link to={`/admin/match/${match.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Edit className="h-4 w-4" />
                      Manage
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}

        {matches.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No matches scheduled yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
