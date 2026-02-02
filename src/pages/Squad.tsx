import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Shield, Swords, Crosshair, Goal, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Player, PlayerPosition } from '@/lib/firestore-types';
import { cn } from '@/lib/utils';

export default function Squad() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Player[]>([]);

  const positionConfig: Record<
    PlayerPosition,
    { label: string; icon: React.ElementType; className: string }
  > = {
    goalkeeper: {
      label: t('squad.goalkeeper') + 's',
      icon: Shield,
      className: 'position-gk',
    },
    defender: {
      label: t('squad.defender') + 's',
      icon: Swords,
      className: 'position-def',
    },
    midfielder: {
      label: t('squad.midfielder') + 's',
      icon: Crosshair,
      className: 'position-mid',
    },
    forward: {
      label: t('squad.forward') + 's',
      icon: Goal,
      className: 'position-fwd',
    },
  };

  const positionOrder: PlayerPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];
   const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const playersQuery = query(
      collection(db, 'players'),
      where('is_active', '==', true),
      orderBy('jersey_number')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
      const playersData: Player[] = [];
      snapshot.forEach(doc => {
        playersData.push({ id: doc.id, ...doc.data() } as Player);
      });
      setPlayers(playersData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching players:', error);
      setIsLoading(false);
    });

    // Cleanup function to unsubscribe when component unmounts
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // The real-time listener will automatically update the data
    // This is just for visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const groupedPlayers = positionOrder.reduce((acc, position) => {
    acc[position] = players.filter((p) => p.position === position);
    return acc;
  }, {} as Record<PlayerPosition, Player[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {t('squad.title')}
              </h1>
              <p className="text-muted-foreground">
                {players.length} {t('dashboard.players')}
              </p>
            </div>
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

      {/* Players by Position */}
      {positionOrder.map((position) => {
        const config = positionConfig[position];
        const positionPlayers = groupedPlayers[position];
        const Icon = config.icon;

        if (positionPlayers.length === 0) return null;

        return (
          <section key={position} className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn('px-3 py-1 font-medium', config.className)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {config.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ({positionPlayers.length})
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {positionPlayers.map((player) => (
                <Card
                  key={player.id}
                  className="player-card card-hover overflow-hidden"
                >
                  <div className="relative">
                    {/* Jersey number badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold text-lg">
                        {player.jersey_number}
                      </div>
                    </div>

                    <CardContent className="pt-6 pb-4">
                      <div className="flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 border-4 border-background shadow-lg mb-4">
                          {player.avatar_url && (
                            <AvatarImage src={player.avatar_url} alt={player.full_name} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl font-bold">
                            {player.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>

                        <h3 className="font-display text-lg font-bold text-foreground mb-1">
                          {player.full_name}
                        </h3>

                        <Badge
                          variant="outline"
                          className={cn('mt-2', config.className)}
                        >
                          {position.charAt(0).toUpperCase() + position.slice(1)}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {players.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{t('squad.noPlayers')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
