-- Supabase Storage Setup for Dots App
-- Run this SQL in your Supabase SQL Editor to set up storage buckets and RLS policies

-- ============================================================================
-- STEP 1: Create Storage Buckets
-- ============================================================================

-- Create the 'images' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,  -- Public bucket (files are publicly accessible)
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Set up RLS Policies for Storage
-- ============================================================================

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated uploads to images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read images" ON storage.objects;

-- Policy: Allow authenticated users to upload/update/delete files in images bucket
-- This is permissive but necessary for the app to work
-- You can make it more restrictive later based on folder structure
CREATE POLICY "Allow authenticated uploads to images bucket"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

-- Policy: Allow public read access to images (since bucket is public)
CREATE POLICY "Allow public read access to images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');
