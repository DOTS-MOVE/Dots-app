-- Add image_url column to messages table
ALTER TABLE IF EXISTS public.messages 
ADD COLUMN IF NOT EXISTS image_url VARCHAR;
