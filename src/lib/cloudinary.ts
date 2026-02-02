const CLOUD_NAME = 'dc09vfass';
const UPLOAD_PRESET = 'sanbitu-football';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  
  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
  };
}

export function getCloudinaryUrl(publicId: string, options?: { width?: number; height?: number }): string {
  let transformations = '';
  
  if (options?.width || options?.height) {
    const parts = [];
    if (options.width) parts.push(`w_${options.width}`);
    if (options.height) parts.push(`h_${options.height}`);
    parts.push('c_fill');
    transformations = parts.join(',') + '/';
  }
  
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformations}${publicId}`;
}
