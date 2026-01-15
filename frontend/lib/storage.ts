'use client';

import { supabase } from './supabase';

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
    
    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get image URL');
    }
    
    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Image upload error:', error);
    throw new Error(error.message || 'Failed to upload image');
  }
}

/**
 * Upload a profile image (avatar, cover, or photo)
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
  const folder = `profiles/${userId}/${type}`;
  return uploadImage(file, 'images', folder);
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
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Image deletion error:', error);
    throw new Error(error.message || 'Failed to delete image');
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
