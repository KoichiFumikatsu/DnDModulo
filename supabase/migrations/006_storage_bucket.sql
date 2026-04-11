-- Create storage bucket for character images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-portraits',
  'character-portraits',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to view (public bucket)
CREATE POLICY "Public portrait read access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'character-portraits');

-- Allow users to delete their own uploads
CREATE POLICY "Users delete own portraits"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
