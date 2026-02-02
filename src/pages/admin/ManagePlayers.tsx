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
import { useTranslation } from 'react-i18next';

const positions: PlayerPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];

export default function ManagePlayers() {
  const { t } = useTranslation();
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
          title: t('players.playerUpdated'),
          description: t('players.playerUpdatedDesc', { name: fullName }),
        });
      } else {
        await addDoc(collection(db, 'players'), {
          ...playerData,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        toast({
          title: t('players.playerAdded'),
          description: t('players.playerAddedDesc', { name: fullName }),
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPlayers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('players.failedToSave'),
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
        title: player.is_active ? t('players.playerDeactivated') : t('players.playerActivated'),
        description: player.is_active 
          ? t('players.playerDeactivatedDesc', { name: player.full_name })
          : t('players.playerActivatedDesc', { name: player.full_name }),
      });

      fetchPlayers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('players.failedToUpdateStatus'),
        variant: 'destructive',
      });
    }
  };

  const deletePlayer = async (player: Player) => {
    if (!player.id) return;

    // Confirmation dialog
    const confirmed = window.confirm(
      t('players.deleteConfirmation', {
        name: player.full_name,
        number: player.jersey_number,
        position: t(`squad.${player.position}`)
      })
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
        title: t('players.playerDeleted'),
        description: t('players.playerDeletedDesc', { name: player.full_name }),
      });

      fetchPlayers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('players.failedToDelete'),
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
              {t('admin.managePlayers')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {players.length} {t('dashboard.players')} {t('common.total')}
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
              {t('players.addNewPlayer')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="font-display">
                {editingPlayer ? t('players.editPlayer') : t('players.addNewPlayer')}
              </DialogTitle>
              <DialogDescription>
                {editingPlayer
                  ? t('players.enterDetails')
                  : t('players.enterDetails')}
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
                <p className="text-xs text-muted-foreground">{t('players.uploadAvatar')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">{t('players.fullName')} *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('players.fullNamePlaceholder')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">{t('players.position')} *</Label>
                  <Select value={position} onValueChange={(v) => setPosition(v as PlayerPosition)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('players.selectPosition')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {t(`squad.${pos}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jerseyNumber">{t('players.jerseyNumber')} *</Label>
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
                <Label htmlFor="email">{t('players.email')} ({t('common.optional')})</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('players.emailPlaceholder')}
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
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingPlayer ? t('common.save') : t('common.create')}
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
                <TableHead className="w-16">{t('players.jerseyNumber')}</TableHead>
                <TableHead>{t('players.fullName')}</TableHead>
                <TableHead>{t('players.position')}</TableHead>
                <TableHead>{t('players.email')}</TableHead>
                <TableHead>{t('players.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                      {t(`squad.${player.position}`)}
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
                        {player.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(player)}
                        title={t('players.editPlayer')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePlayer(player)}
                        title={t('common.delete')}
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
                    {t('squad.noPlayers')}
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
