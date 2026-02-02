import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Newspaper, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { Announcement } from '@/lib/firestore-types';

// Helper to convert Firestore Timestamp or string to Date (consistent with ManageAnnouncements)
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

export default function News() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    console.log('Setting up announcements listener...');
    
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('is_published', '==', true),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      console.log('News: Announcements snapshot received:', snapshot.size, 'documents');
      const announcementsData: Announcement[] = [];
      
      snapshot.forEach(doc => {
        try {
          const data = doc.data();
          console.log('News: Processing announcement document:', { id: doc.id, ...data });
          
          // Validate required fields
          if (!data.title || !data.content || typeof data.is_published !== 'boolean') {
            console.warn('News: Skipping invalid announcement:', doc.id, data);
            return;
          }
          
          const announcement = { id: doc.id, ...data } as Announcement;
          announcementsData.push(announcement);
          console.log('News: Added announcement:', announcement.title, 'Published:', announcement.is_published);
        } catch (error) {
          console.error('News: Error processing document:', doc.id, error);
        }
      });
      
      console.log('News: Final announcements array:', announcementsData.length, 'items');
      console.log('News: Published announcements:', announcementsData.filter(a => a.is_published).length);
      setAnnouncements(announcementsData);
      setIsLoading(false);
    }, (error) => {
      console.error('News: Error fetching announcements:', error);
      console.log('News: Error code:', error.code);
      console.log('News: Error message:', error.message);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

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
              <Newspaper className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Club News
              </h1>
              <p className="text-muted-foreground">
                Latest updates and announcements
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
            Refresh
          </Button>
        </div>
      </div>

      {/* News Grid */}
      {announcements.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {announcements.map((announcement, index) => (
            <Card
              key={announcement.id}
              className={`card-hover overflow-hidden ${
                index === 0 ? 'md:col-span-2 lg:col-span-2' : ''
              }`}
            >
              {announcement.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={announcement.image_url}
                    alt={announcement.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Calendar className="h-3 w-3" />
                  {format(toDate(announcement.created_at), 'PPP')}
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {announcement.title}
                </h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground line-clamp-3">
                  {announcement.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-lg mb-2">No News Yet</h3>
            <p className="text-muted-foreground">
              Check back later for the latest club announcements and updates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
