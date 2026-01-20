# Quick Fix: Supabase Storage RLS Policy Error

## The Problem
You're seeing: `new row violates row-level security policy`

This means the storage bucket exists but the RLS (Row Level Security) policies aren't set up to allow uploads.

## Quick Fix (5 minutes)

### 1. Go to Storage → Your Bucket → Policies

1. Open your Supabase Dashboard
2. Click **Storage** in the left menu
3. Click on the **`images`** bucket (or create it if it doesn't exist)
4. Click the **"Policies"** tab

### 2. Create These Two Policies

**Policy 1: Allow Uploads**
- Click **"New Policy"** → **"For full customization"**
- **Name**: `Allow authenticated uploads`
- **Operation**: Select **"All operations"** (or manually select INSERT, UPDATE, DELETE)
- **Target roles**: `authenticated`
- **USING**: `bucket_id = 'images'`
- **WITH CHECK**: `bucket_id = 'images'`
- Click **"Save"**

**Policy 2: Allow Public Read**
- Click **"New Policy"** again → **"For full customization"**
- **Name**: `Allow public read access`
- **Operation**: Select **"SELECT"** only
- **Target roles**: `public`
- **USING**: `bucket_id = 'images'`
- **WITH CHECK**: (leave empty or use `bucket_id = 'images'`)
- Click **"Save"**

### 3. Verify

After creating both policies, try uploading an image again. It should work!

## Still Not Working?

1. Make sure the bucket is **Public** (toggle in bucket settings)
2. Make sure you're **logged in** when trying to upload
3. Check that the policies show as **Active** in the Policies tab

## Visual Guide

```
Supabase Dashboard
  → Storage
    → images (bucket)
      → Policies tab
        → New Policy (create both policies above)
```

That's it! This should fix the RLS policy error.
