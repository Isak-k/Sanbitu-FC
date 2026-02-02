import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Loader2,
  Plus,
  Newspaper,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { Announcement } from '@/lib/firestore-types';
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

export default function ManageAnnouncements() {
  const { t } = useTranslation();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    console.log('Admin: Setting up announcements listener...');
    
    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      console.log('Admin: Announcements snapshot received:', snapshot.size, 'documents');
      const announcementsData: Announcement[] = [];
      
      snapshot.forEach(doc => {
        try {
          const data = doc.data();
          console.log('Admin: Processing announcement document:', { id: doc.id, ...data });
          
          const announcement = { id: doc.id, ...data } as Announcement;
          announcementsData.push(announcement);
          console.log('Admin: Added announcement:', announcement.title, 'Published:', announcement.is_published);
        } catch (error) {
          console.error('Admin: Error processing document:', doc.id, error);
        }
      });
      
      console.log('Admin: Final announcements array:', announcementsData.length, 'items');
      console.log('Admin: Published announcements:', announcementsData.filter(a => a.is_published).length);
      setAnnouncements(announcementsData);
      setIsLoading(false);
    }, (error) => {
      console.error('Admin: Error fetching announcements:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    setIsPublished(true);
    setEditingAnnouncement(null);
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setImageUrl(announcement.image_url || '');
    setImagePreview(announcement.image_url || null);
    setIsPublished(announcement.is_published);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      // Clear URL input if file is selected
      setImageUrl('');
    }
  };

  const removeSelectedImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let currentImageUrl = imageUrl.trim() || null;
      let currentImagePublicId = editingAnnouncement?.image_public_id || null;

      // Handle file upload if a new file is selected
      if (imageFile) {
        console.log('Admin: Uploading image to Cloudinary...');
        const uploadResult = await uploadToCloudinary(imageFile);
        currentImageUrl = uploadResult.secure_url;
        currentImagePublicId = uploadResult.public_id;
        console.log('Admin: Image uploaded successfully:', currentImageUrl);
      }

      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        image_url: currentImageUrl,
        image_public_id: currentImagePublicId,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      };

      if (editingAnnouncement && editingAnnouncement.id) {
        console.log('Admin: Updating announcement:', editingAnnouncement.id, announcementData);
        await updateDoc(doc(db, 'announcements', editingAnnouncement.id), announcementData);
        console.log('Admin: Announcement updated successfully');
        
        toast({
          title: t('announcements.announcementUpdated'),
          description: t('announcements.announcementUpdatedDesc'),
        });
      } else {
        const newAnnouncementData = {
          ...announcementData,
          created_at: new Date().toISOString(),
        };
        
        console.log('Admin: Creating announcement with data:', newAnnouncementData);
        
        const docRef = await addDoc(collection(db, 'announcements'), newAnnouncementData);
        
        console.log('Admin: Announcement created successfully with ID:', docRef.id);
        console.log('Admin: Published status:', isPublished);
        console.log('Admin: This announcement should', isPublished ? 'appear on News page immediately' : 'be saved as draft');
        
        toast({
          title: t('announcements.announcementPosted'),
          description: t('announcements.announcementPostedDesc', { 
            status: isPublished ? t('announcements.publishedAndVisible') : t('announcements.savedAsDraft') 
          }),
        });
      }

      setIsDialogOpen(false);
      resetForm();
      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('announcements.failedToSave'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePublished = async (announcement: Announcement) => {
    if (!announcement.id) return;

    const newStatus = !announcement.is_published;
    console.log('Admin: Toggling announcement publish status:', announcement.id, 'from', announcement.is_published, 'to', newStatus);

    try {
      await updateDoc(doc(db, 'announcements', announcement.id), {
        is_published: newStatus,
        updated_at: new Date().toISOString(),
      });

      console.log('Admin: Announcement publish status updated successfully');
      console.log('Admin: Announcement should now', newStatus ? 'appear on News page' : 'be hidden from News page');

      toast({
        title: newStatus ? t('announcements.publishedSuccess') : t('announcements.unpublishedSuccess'),
        description: t('announcements.publishStatusDesc', { 
          status: newStatus ? t('announcements.publishedAndVisibleDesc') : t('announcements.unpublishedAndHiddenDesc') 
        }),
      });

    } catch (error: any) {
      console.error('Admin: Error toggling publish status:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm(t('announcements.deleteConfirm'))) return;

    try {
      await deleteDoc(doc(db, 'announcements', id));

      toast({
        title: t('common.success'),
        description: t('messages.itemDeleted'),
      });

      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
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
            <Newspaper className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('admin.announcements')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('announcements.announcementsCount', { count: announcements.length })}
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
              {t('announcements.newAnnouncement')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="font-display">
                {editingAnnouncement ? t('announcements.editAnnouncement') : t('announcements.newAnnouncement')}
              </DialogTitle>
              <DialogDescription>
                {editingAnnouncement
                  ? t('announcements.updateAnnouncementDetails')
                  : t('announcements.createNewAnnouncement')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('announcements.title')} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('announcements.announcementTitle')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{t('announcements.content')} *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('announcements.writeAnnouncement')}
                  rows={5}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('announcements.announcementImage')}</Label>
                <div className="flex flex-col gap-4">
                  {imagePreview ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={removeSelectedImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-3 rounded-full bg-primary/10">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{t('announcements.clickToUpload')}</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG or WebP</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {t('announcements.orProvideUrl')}
                      </span>
                    </div>
                  </div>

                  <Input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      if (e.target.value) {
                        setImagePreview(e.target.value);
                        setImageFile(null);
                      } else if (!imageFile) {
                        setImagePreview(null);
                      }
                    }}
                    placeholder={t('announcements.imageUrlPlaceholder')}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
                <Label htmlFor="isPublished">{t('announcements.isPublished')}</Label>
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
                  {editingAnnouncement ? t('announcements.saveChanges') : t('announcements.postAnnouncement')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Announcements Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('announcements.title')}</TableHead>
                <TableHead>{t('fixtures.matchDate')}</TableHead>
                <TableHead>{t('matches.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {announcement.content}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(toDate(announcement.created_at), 'PP')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={announcement.is_published ? 'default' : 'secondary'}
                      className={
                        announcement.is_published
                          ? 'bg-emerald-500/20 text-emerald-700'
                          : ''
                      }
                    >
                      {announcement.is_published ? t('announcements.published') : t('announcements.draftStatus')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePublished(announcement)}
                        title={announcement.is_published ? t('announcements.unpublish') : t('announcements.publish')}
                      >
                        {announcement.is_published ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(announcement)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAnnouncement(announcement.id!)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {announcements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    {t('announcements.noAnnouncements')}
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
