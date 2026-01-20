# Supabase Storage Setup

This guide will help you set up Supabase Storage for image uploads in the Dots app.

## Manual Setup (Recommended - Works without SQL Editor)

### Step 1: Create the Storage Bucket

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **Storage** in the left sidebar

2. **Create a New Bucket**
   - Click **"New bucket"** or **"Create bucket"** button
   - Fill in the details:
     - **Name**: `images`
     - **Public bucket**: ✅ **Toggle ON** (this makes files publicly accessible)
     - **File size limit**: `5242880` (5MB in bytes) or just `5` if it asks for MB
     - **Allowed MIME types** (optional): `image/jpeg, image/jpg, image/png, image/gif, image/webp`
   - Click **"Create bucket"** or **"Save"**

### Step 2: Set Up RLS Policies (CRITICAL)

1. **Open Storage Policies**
   - In the Storage section, click on your `images` bucket
   - Click on the **"Policies"** tab (or **"RLS Policies"**)

2. **Create Upload Policy**
   - Click **"New Policy"** or **"Create Policy"**
   - Choose **"For full customization"** or **"Create policy from scratch"**
   - Fill in:
     - **Policy name**: `Allow authenticated uploads`
     - **Allowed operation**: Select **INSERT, UPDATE, DELETE** (or use "All operations")
     - **Target roles**: `authenticated`
     - **USING expression**: `bucket_id = 'images'`
     - **WITH CHECK expression**: `bucket_id = 'images'`
   - Click **"Review"** then **"Save policy"**

3. **Create Read Policy**
   - Click **"New Policy"** again
   - Fill in:
     - **Policy name**: `Allow public read access`
     - **Allowed operation**: Select **SELECT** (read)
     - **Target roles**: `public`
     - **USING expression**: `bucket_id = 'images'`
   - Click **"Review"** then **"Save policy"**

### Step 3: Verify Setup

1. Check that both policies are listed in the Policies tab
2. Make sure the bucket is marked as **Public**
3. Try uploading an image from your app - it should work now!

## Alternative: Using SQL Editor (If Available)

If you have access to the SQL Editor, you can run the `backend/setup_storage.sql` script instead.

## Troubleshooting

### Error: "new row violates row-level security policy"

This means the RLS policies haven't been set up yet. Make sure you've run the `setup_storage.sql` script.

### Error: "Bucket not found"

The bucket might not have been created. Check the Storage section in your Supabase dashboard. If the bucket doesn't exist, run the SQL script again.

### Error: "Permission denied"

Make sure:
1. The user is logged in (authenticated)
2. The RLS policies have been created
3. The bucket exists and is public

## Manual Setup (Alternative)

If the SQL script doesn't work, you can set up the bucket manually:

1. **Create the Bucket**:
   - Go to **Storage** → **Buckets**
   - Click **New bucket**
   - Name: `images`
   - Make it **Public**
   - Set file size limit to 5MB
   - Add allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`

2. **Set up Policies**:
   - Go to **Storage** → **Policies**
   - Select the `images` bucket
   - Create a new policy:
     - Policy name: "Allow authenticated uploads"
     - Allowed operation: All
     - Target roles: `authenticated`
     - USING expression: `bucket_id = 'images'`
     - WITH CHECK expression: `bucket_id = 'images'`
   - Create another policy:
     - Policy name: "Allow public read"
     - Allowed operation: SELECT
     - Target roles: `public`
     - USING expression: `bucket_id = 'images'`

## Testing

After setup, try uploading an image from the profile page. If it works, you should see the image appear and the error should be gone.
