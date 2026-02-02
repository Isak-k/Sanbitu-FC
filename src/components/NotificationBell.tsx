import { useState, useEffect } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { Announcement } from '@/lib/firestore-types';

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

export function NotificationBell() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Load deleted IDs from localStorage on mount
  useEffect(() => {
    const savedDeletedIds = localStorage.getItem('deletedNotifications');
    if (savedDeletedIds) {
      try {
        setDeletedIds(new Set(JSON.parse(savedDeletedIds)));
      } catch (e) {
        console.error('Error parsing deleted notifications:', e);
      }
    }
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newDeletedIds = new Set(deletedIds);
    newDeletedIds.add(id);
    setDeletedIds(newDeletedIds);
    localStorage.setItem('deletedNotifications', JSON.stringify(Array.from(newDeletedIds)));
    
    // Update unread count if needed
    if (unreadCount > 0) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    toast({
      title: "Notification removed",
      description: "The notification has been removed from your list.",
      duration: 2000,
    });
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDeletedIds = new Set(deletedIds);
    announcements.forEach(a => {
      if (a.id) newDeletedIds.add(a.id);
    });
    setDeletedIds(newDeletedIds);
    localStorage.setItem('deletedNotifications', JSON.stringify(Array.from(newDeletedIds)));
    setUnreadCount(0);
    
    toast({
      title: "All notifications cleared",
      description: "Your notification list is now empty.",
      duration: 2000,
    });
  };

  useEffect(() => {
    console.log('🔔 NotificationBell: Starting listener...');
    
    // Simple query without complex filtering
    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('created_at', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        console.log('🔔 NotificationBell: Snapshot received, docs:', snapshot.size);
        
        const allAnnouncements: Announcement[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          allAnnouncements.push({
            id: doc.id,
            ...data
          } as Announcement);
        });

        // Filter published announcements
        const publishedAnnouncements = allAnnouncements.filter(a => a.is_published === true);
        setAnnouncements(publishedAnnouncements);
        
        // Update unread count based on non-deleted items
        const visibleCount = publishedAnnouncements.filter(a => a.id && !deletedIds.has(a.id)).length;
        setUnreadCount(visibleCount);
        
        setIsLoading(false);
        
        // Show toast for new announcements if not deleted
        if (publishedAnnouncements.length > 0 && !isLoading) {
          const latestAnnouncement = publishedAnnouncements[0];
          if (latestAnnouncement.id && !deletedIds.has(latestAnnouncement.id)) {
            toast({
              title: "📢 New Announcement",
              description: latestAnnouncement.title,
              duration: 3000,
            });
          }
        }
      },
      (error) => {
        console.error('🔔 NotificationBell Error:', error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔔 NotificationBell: Cleaning up');
      unsubscribe();
    };
  }, [isLoading, deletedIds]); // Re-run when deletedIds changes to update counts correctly

  const handleOpen = (open: boolean) => {
    console.log('🔔 Popover opened:', open);
    setIsOpen(open);
    
    // Mark as read when opened
    if (open && unreadCount > 0) {
      console.log('🔔 Marking notifications as read');
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = (announcement: Announcement) => {
    console.log('🔔 Clicked notification:', announcement.title);
    setIsOpen(false);
    navigate('/news');
  };

  // Filter out deleted announcements for display
  const visibleAnnouncements = announcements.filter(a => a.id && !deletedIds.has(a.id));

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-5 w-5 ${isLoading ? 'animate-pulse' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            )}
          </div>
          {visibleAnnouncements.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
              onClick={handleClearAll}
            >
              <Trash2 className="h-3 w-3" />
              Clear All
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Loading...</p>
            </div>
          ) : visibleAnnouncements.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No new notifications</p>
            </div>
          ) : (
            <div>
              {visibleAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="p-4 border-b hover:bg-gray-50 cursor-pointer group relative"
                  onClick={() => handleNotificationClick(announcement)}
                >
                  <div className="pr-6">
                    <h5 className="font-medium text-sm">{announcement.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      {formatDistanceToNow(toDate(announcement.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDelete(e, announcement.id!)}
                    title="Remove notification"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setIsOpen(false);
              navigate('/news');
            }}
          >
            View All News
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
