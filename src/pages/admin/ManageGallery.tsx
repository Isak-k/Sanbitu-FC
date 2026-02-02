import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Image as ImageIcon, Trash2, Plus, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { GalleryItem } from '@/lib/firestore-types';

export default function ManageGallery() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const galleryQuery = query(
        collection(db, 'gallery'),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(galleryQuery);
      const galleryData: GalleryItem[] = [];
      snapshot.forEach(doc => {
        galleryData.push({ id: doc.id, ...doc.data() } as GalleryItem);
      });
      setImages(galleryData);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast({
        title: 'Error',
        description: 'Please select an image to upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(imageFile);

      // Save to Firestore
      await addDoc(collection(db, 'gallery'), {
        title: title.trim() || null,
        image_url: uploadResult.secure_url,
        image_public_id: uploadResult.public_id,
        is_visible: true,
        created_at: new Date().toISOString(),
      });

      toast({
        title: 'Photo Added',
        description: 'The photo has been added to the gallery.',
      });

      setTitle('');
      setImageFile(null);
      setImagePreview(null);
      setDialogOpen(false);
      fetchGallery();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add photo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await deleteDoc(doc(db, 'gallery', id));

      toast({
        title: 'Photo Deleted',
        description: 'The photo has been removed from the gallery.',
      });

      fetchGallery();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete photo.',
        variant: 'destructive',
      });
    }
  };

  const toggleVisibility = async (image: GalleryItem) => {
    if (!image.id) return;
    
    try {
      const newVisibility = !(image.is_visible !== false);
      await updateDoc(doc(db, 'gallery', image.id), {
        is_visible: newVisibility,
      });

      toast({
        title: newVisibility ? 'Photo Visible' : 'Photo Hidden',
        description: `Photo is now ${newVisibility ? 'visible' : 'hidden'} to users.`,
      });

      fetchGallery();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update visibility.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <ImageIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Manage Gallery
            </h1>
            <p className="text-muted-foreground text-sm">
              Upload and manage club photos
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Photo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background max-h-[90vh] flex flex-col p-0 sm:max-w-md">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Add New Photo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {/* Image Upload */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="w-full h-40 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  ) : (
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select image</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title (Optional)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Match vs. Team X"
                />
              </div>

              <Button type="submit" disabled={isSubmitting || !imageFile} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Add Photo'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No photos in the gallery</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setDialogOpen(true)}
            >
              Add Your First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden group relative">
              <div className="aspect-square">
                <img
                  src={image.image_url}
                  alt={image.title || 'Gallery image'}
                  className={`w-full h-full object-cover ${image.is_visible === false ? 'opacity-50' : ''}`}
                />
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => toggleVisibility(image)}
                  title={image.is_visible !== false ? 'Hide from users' : 'Show to users'}
                >
                  {image.is_visible !== false ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(image.id!)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {image.is_visible === false && (
                <div className="absolute top-2 left-2">
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {image.title && (
                <div className="p-2 border-t border-border">
                  <p className="text-sm font-medium truncate">{image.title}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
