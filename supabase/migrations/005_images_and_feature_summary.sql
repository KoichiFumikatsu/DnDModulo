-- Multiple character images (rage, polymorphed, etc.)
CREATE TABLE character_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  label text NOT NULL DEFAULT 'Default',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE character_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own character images"
  ON character_images FOR ALL
  USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE INDEX idx_character_images_char ON character_images(character_id);

-- Feature summary for compact display
ALTER TABLE character_features ADD COLUMN IF NOT EXISTS summary text;
