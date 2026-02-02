import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, orderBy, query, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { GalleryItem } from '@/lib/firestore-types';
import { useTranslation } from 'react-i18next';

export default function Gallery() {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const galleryQuery = query(
      collection(db, 'gallery'),
      orderBy('created_at', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(galleryQuery, (snapshot) => {
      const galleryData: GalleryItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only include visible images (treat undefined as visible for backward compatibility)
        if (data.is_visible !== false) {
          galleryData.push({ id: doc.id, ...data } as GalleryItem);
        }
      });
      setImages(galleryData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching gallery:', error);
      setIsLoading(false);
    });

    // Cleanup function
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <ImageIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('gallery.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('gallery.subtitle')}
          </p>
        </div>
      </div>

      {images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t('gallery.noImages')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Dialog key={image.id}>
              <DialogTrigger asChild>
                <Card className="overflow-hidden cursor-pointer hover-scale group">
                  <div className="aspect-square relative">
                    <img
                      src={image.image_url}
                      alt={image.title || 'Gallery image'}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    {image.title && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-white text-sm font-medium truncate">
                          {image.title}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0 bg-background">
                <img
                  src={image.image_url}
                  alt={image.title || 'Gallery image'}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
                {image.title && (
                  <div className="p-4 border-t border-border">
                    <p className="font-medium text-foreground">{image.title}</p>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </div>
  );
}
