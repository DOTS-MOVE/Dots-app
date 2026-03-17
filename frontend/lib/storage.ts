'use client';

import { supabase } from './supabase';

/** Max dimensions and quality for profile images - keeps uploads fast */
const PROFILE_IMAGE_SPECS = {
  avatar: { maxWidth: 400, maxHeight: 400, quality: 0.85 },
  cover: { maxWidth: 1200, maxHeight: 600, quality: 0.85 },
  photo: { maxWidth: 800, maxHeight: 800, quality: 0.85 },
} as const;

/**
 * Resize and compress an image for faster uploads (uses Canvas, no deps)
 */
export async function compressImageForUpload(
  file: File,
  type: 'avatar' | 'cover' | 'photo'
): Promise<File> {
  const specs = PROFILE_IMAGE_SPECS[type];
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { maxWidth, maxHeight, quality } = specs;
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight && file.size < 300 * 1024) {
        resolve(file); // Already small enough
        return;
      }
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * Upload an image file to Supabase Storage
 * @param file - The image file to upload
 * @param bucket - The storage bucket name (default: 'images')
 * @param folder - Optional folder path within the bucket (e.g., 'events', 'profiles')
 * @param fileName - Optional custom filename. If not provided, generates a unique name
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
  file: File,
  bucket: string = 'images',
  folder?: string,
  fileName?: string
): Promise<string> {
  try {
    // Generate a unique filename if not provided
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const finalFileName = fileName || `${timestamp}-${randomStr}.${fileExt}`;
    
    // Construct the file path
    const filePath = folder ? `${folder}/${finalFileName}` : finalFileName;
    
    // Log upload attempt details
    console.log(`[Storage Upload] Attempting to upload image:`, {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      fileType: file.type,
      bucket,
      folder,
      filePath,
      timestamp: new Date().toISOString()
    });
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const errorMsg = 'User not authenticated. Please log in to upload images.';
      console.error(`[Storage Upload Error] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`[Storage Upload] User authenticated: ${session.user.email}`);
    
    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      // Provide detailed error information
      let errorDetails = `Failed to upload image to bucket "${bucket}"`;
      if (folder) {
        errorDetails += ` in folder "${folder}"`;
      }
      errorDetails += `\n\nFile Details:`;
      errorDetails += `\n  - Name: ${file.name}`;
      errorDetails += `\n  - Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      errorDetails += `\n  - Type: ${file.type}`;
      errorDetails += `\n  - Target Path: ${filePath}`;
      errorDetails += `\n\nError: ${error.message}`;
      
      // Provide specific guidance based on error type
      if (error.message.includes('row-level security') || error.message.includes('RLS')) {
        errorDetails += `\n\n🔧 Fix: This is a Row-Level Security (RLS) policy error.`;
        errorDetails += `\n   1. Go to your Supabase Dashboard → SQL Editor`;
        errorDetails += `\n   2. Run the script: backend/setup_storage.sql`;
        errorDetails += `\n   3. This will create the bucket and set up RLS policies`;
        errorDetails += `\n   4. See backend/STORAGE_SETUP.md for detailed instructions`;
      } else if (error.message.includes('Bucket not found') || error.message.includes('does not exist')) {
        errorDetails += `\n\n🔧 Fix: The storage bucket "${bucket}" doesn't exist.`;
        errorDetails += `\n   1. Go to Supabase Dashboard → Storage → Buckets`;
        errorDetails += `\n   2. Create a new bucket named "${bucket}"`;
        errorDetails += `\n   3. Make it public and set up RLS policies`;
        errorDetails += `\n   4. Or run: backend/setup_storage.sql`;
      } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        errorDetails += `\n\n🔧 Fix: Permission denied.`;
        errorDetails += `\n   1. Make sure you're logged in`;
        errorDetails += `\n   2. Check that RLS policies allow authenticated users to upload`;
        errorDetails += `\n   3. Run: backend/setup_storage.sql to set up policies`;
      } else if (error.message.includes('size') || error.message.includes('too large')) {
        errorDetails += `\n\n🔧 Fix: File is too large.`;
        errorDetails += `\n   - Maximum file size: 5MB`;
        errorDetails += `\n   - Your file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      }
      
      console.error(`[Storage Upload Error] ${errorDetails}`);
      throw new Error(errorDetails);
    }
    
    console.log(`[Storage Upload] Successfully uploaded to: ${filePath}`);
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    if (!urlData?.publicUrl) {
      const errorMsg = `Failed to get public URL for uploaded image at path: ${filePath}`;
      console.error(`[Storage Upload Error] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`[Storage Upload] Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error: any) {
    // If error is already a detailed Error object, re-throw it
    if (error.message && error.message.includes('\n')) {
      throw error;
    }
    
    // Otherwise, create a detailed error message
    const errorDetails = `Image upload failed:\n\n` +
      `File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB, ${file.type})\n` +
      `Bucket: ${bucket}\n` +
      `Path: ${folder ? `${folder}/` : ''}${fileName || file.name}\n` +
      `Error: ${error.message || 'Unknown error'}\n\n` +
      `Check the browser console for more details.`;
    
    console.error(`[Storage Upload Error] ${errorDetails}`, error);
    throw new Error(errorDetails);
  }
}

/**
 * Upload a profile image (avatar, cover, or photo)
 * Compresses images client-side for faster uploads.
 * @param file - The image file to upload
 * @param type - Type of profile image: 'avatar', 'cover', or 'photo'
 * @param userId - The user ID
 * @returns The public URL of the uploaded image
 */
export async function uploadProfileImage(
  file: File,
  type: 'avatar' | 'cover' | 'photo',
  userId: number
): Promise<string> {
  const compressed = await compressImageForUpload(file, type);
  const folder = `profiles/${userId}/${type}`;
  return uploadImage(compressed, 'images', folder);
}

/**
 * Upload an event cover/banner image
 * @param file - The image file to upload
 * @param eventId - Optional event ID (for updates, otherwise will be set after creation)
 * @returns The public URL of the uploaded image
 */
export async function uploadEventImage(
  file: File,
  eventId?: number
): Promise<string> {
  const folder = eventId ? `events/${eventId}` : 'events/temp';
  return uploadImage(file, 'images', folder);
}

/**
 * Delete an image from Supabase Storage
 * @param filePath - The path to the file in storage (relative to bucket)
 * @param bucket - The storage bucket name (default: 'images')
 */
export async function deleteImage(
  filePath: string,
  bucket: string = 'images'
): Promise<void> {
  try {
    console.log(`[Storage Delete] Attempting to delete image:`, {
      bucket,
      filePath,
      timestamp: new Date().toISOString()
    });
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      let errorDetails = `Failed to delete image from bucket "${bucket}":\n\n` +
        `Path: ${filePath}\n` +
        `Error: ${error.message}\n\n`;
      
      if (error.message.includes('row-level security') || error.message.includes('RLS')) {
        errorDetails += `🔧 Fix: RLS policy error. Check that policies allow deletion.\n`;
      } else if (error.message.includes('not found')) {
        errorDetails += `🔧 Fix: File may have already been deleted.\n`;
      }
      
      console.error(`[Storage Delete Error] ${errorDetails}`);
      throw new Error(errorDetails);
    }
    
    console.log(`[Storage Delete] Successfully deleted: ${filePath}`);
  } catch (error: any) {
    const errorDetails = `Image deletion failed:\n\n` +
      `Bucket: ${bucket}\n` +
      `Path: ${filePath}\n` +
      `Error: ${error.message || 'Unknown error'}\n`;
    
    console.error(`[Storage Delete Error] ${errorDetails}`, error);
    throw new Error(errorDetails);
  }
}

/**
 * Extract file path from Supabase Storage URL
 * @param url - The public URL of the image
 * @returns The file path relative to the bucket, or null if not a Supabase Storage URL
 */
export function extractFilePathFromUrl(url: string): string | null {
  try {
    // Supabase Storage URLs typically look like:
    // https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
    if (match && match[2]) {
      return match[2];
    }
    return null;
  } catch {
    return null;
  }
}
