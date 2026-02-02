import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  Plus,
  Users,
  Edit,
  Upload,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Player, PlayerPosition } from '@/lib/firestore-types';
import { cn } from '@/lib/utils';

const positions: PlayerPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];

export default function ManagePlayers() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('midfielder');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [email, setEmail] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    try {
      const playersQuery = query(collection(db, 'players'), orderBy('jersey_number'));
      const snapshot = await getDocs(playersQuery);
      const playersData: Player[] = [];
      snapshot.forEach(doc => {
        playersData.push({ id: doc.id, ...doc.data() } as Player);
      });
      setPlayers(playersData);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const resetForm = () => {
    setFullName('');
    setPosition('midfielder');
    setJerseyNumber('');
    setEmail('');
    setEditingPlayer(null);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const openEditDialog = (player: Player) => {
    setEditingPlayer(player);
    setFullName(player.full_name);
    setPosition(player.position);
    setJerseyNumber(player.jersey_number.toString());
    setEmail(player.email || '');
    setAvatarPreview(player.avatar_url || null);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let avatarUrl = editingPlayer?.avatar_url || null;
      let imagePublicId = editingPlayer?.image_public_id || null;

      // Upload avatar if new file selected
      if (avatarFile) {
        const uploadResult = await uploadToCloudinary(avatarFile);
        avatarUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      }

      const playerData = {
        full_name: fullName.trim(),
        position,
        jersey_number: parseInt(jerseyNumber),
        email: email.trim() || null,
        avatar_url: avatarUrl,
        image_public_id: imagePublicId,
        updated_at: new Date().toISOString(),
      };

      if (editingPlayer && editingPlayer.id) {
        await updateDoc(doc(db, 'players', editingPlayer.id), playerData);
        toast({
          title: 'Player Updated',
          description: `${fullName} has been updated successfully.`,
        });
      } else {
        await addDoc(collection(db, 'players'), {
          ...playerData,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        toast({
          title: 'Player Added',
          description: `${fullName} has been added to the squad.`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPlayers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save player.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePlayerStatus = async (player: Player) => {
    if (!player.id) return;
    
    try {
      await updateDoc(doc(db, 'players', player.id), {
        is_active: !player.is_active,
      });

      toast({
        title: player.is_active ? 'Player Deactivated' : 'Player Activated',
        description: `${player.full_name} has been ${
          player.is_active ? 'deactivated' : 'activated'
        }.`,
      });

      fetchPlayers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update player status.',
        variant: 'destructive',
      });
    }
  };

  const deletePlayer = async (player: Player) => {
    if (!player.id) return;

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${player.full_name}?\n\n` +
      `Jersey Number: #${player.jersey_number}\n` +
      `Position: ${player.position}\n\n` +
      `This will permanently remove the player from the system and all associated match data (lineups, events).\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // First, we need to find and clean up all references to this player
      // Get all matches to check for lineups and events
      const matchesSnapshot = await getDocs(collection(db, 'matches'));
      
      const cleanupPromises: Promise<void>[] = [];

      // For each match, check and clean up lineups and events
      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        
        // Clean up lineups
        const lineupsSnapshot = await getDocs(collection(db, 'matches', matchId, 'lineups'));
        lineupsSnapshot.docs.forEach(lineupDoc => {
          const lineupData = lineupDoc.data();
          if (lineupData.player_id === player.id) {
            cleanupPromises.push(deleteDoc(lineupDoc.ref));
          }
        });

        // Clean up events
        const eventsSnapshot = await getDocs(collection(db, 'matches', matchId, 'events'));
        eventsSnapshot.docs.forEach(eventDoc => {
          const eventData = eventDoc.data();
          if (eventData.player_id === player.id) {
            cleanupPromises.push(deleteDoc(eventDoc.ref));
          }
        });
      }

      // Wait for all cleanup operations to complete
      await Promise.all(cleanupPromises);

      // Finally, delete the player document
      await deleteDoc(doc(db, 'players', player.id));

      toast({
        title: 'Player Deleted',
        description: `${player.full_name} and all associated match data have been permanently removed.`,
      });

      fetchPlayers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete player.',
        variant: 'destructive',
      });
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Manage Players
            </h1>
            <p className="text-muted-foreground text-sm">
              {players.length} players registered
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
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="font-display">
                {editingPlayer ? 'Edit Player' : 'Add New Player'}
              </DialogTitle>
              <DialogDescription>
                {editingPlayer
                  ? 'Update player information'
                  : 'Add a new player to the squad'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarPreview && <AvatarImage src={avatarPreview} />}
                  <AvatarFallback className="bg-primary/10">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">Click to upload photo</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Player's full name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Select value={position} onValueChange={(v) => setPosition(v as PlayerPosition)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jerseyNumber">Jersey # *</Label>
                  <Input
                    id="jerseyNumber"
                    type="number"
                    min="1"
                    max="99"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                    placeholder="1-99"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                />
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
                  {editingPlayer ? 'Save Changes' : 'Add Player'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Players Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {player.jersey_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {player.avatar_url && <AvatarImage src={player.avatar_url} />}
                        <AvatarFallback className="text-xs">
                          {player.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{player.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {player.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {player.email || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={player.is_active}
                        onCheckedChange={() => togglePlayerStatus(player)}
                      />
                      <span className={cn(
                        'text-sm',
                        player.is_active ? 'text-emerald-600' : 'text-muted-foreground'
                      )}>
                        {player.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(player)}
                        title="Edit player"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePlayer(player)}
                        title="Delete player"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {players.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No players registered yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
